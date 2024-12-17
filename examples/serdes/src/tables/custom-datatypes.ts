import {
  $DeserializeForTable,
  $SerializeForTable,
  Db,
  SnakeCaseInterop,
  SomeDoc,
  TableCodec,
  TableCodecs,
  TableDesCtx,
  TableSerCtx,
} from '@datastax/astra-db-ts';

interface User {
  userId: UserID,
  fullName: string,
  birthdate: Date,
  milestones: AssocList<string, Date>,
}

export async function TableCustomDatatypesExample(name: string, db: Db) {
  const table = await db.createTable<User>(name, {
    definition: {
      columns: {
        user_id: 'uuid',
        full_name: 'text',
        birthdate: 'timestamp',
        milestones: { type: 'map', keyType: 'text', valueType: 'timestamp' },
      },
      primaryKey: 'user_id',
    },
    serdes: {
      mutateInPlace: true, // Optimization for serialization if you don't need to use the doc again once you pass it in
      keyTransformer: new SnakeCaseInterop(), // Convert camelCase to/from snake_case for column names
      codecs: [
        DateCodec,
        UserIDCodec,
        FullNameCodec,
        AssocListCodec,
      ],
    },
  });

  // Insert a row
  const inserted = await table.insertOne({
    userId: new UserID('123e4567-e89b-12d3-a456-426614174000'),
    fullName: 'Alice',
    birthdate: new Date('2000-01-01'),
    milestones: new AssocList([
      ['First steps', new Date('2001-02-08')],
      ['First car', new Date('2020-07-23')],
    ]),
  });
  console.dir(inserted, { depth: null });

  // Find a row
  const found = await table.findOne({ userId: inserted.insertedId.userId });
  console.dir(found, { depth: null });
}

// UserID "newtype"/"value" wrapper around the user's UUID string

class UserID {
  constructor(public uuid: string) {}
}

const UserIDCodec = TableCodecs.forName('userId', {
  serialize: (_, value: UserID, ctx) =>  ctx.done(value.uuid),
  deserialize: (_, value: string, ctx) => ctx.done(new UserID(value)),
});

// Demonstrates validation logic through codecs

const FullNameCodec = TableCodecs.forName('fullName', {
  serialize: (_, value: string, ctx) => {
    if (!value) {
      throw new Error('Full name must not be empty');
    }
    return ctx.done(value);
  },
  deserialize: (_, value: string, ctx) => ctx.done(value),
});

// Example of retrofitting a type you don't own (or don't want to pollute with serdes logic)

const DateCodec = TableCodecs.forType('timestamp', {
  serializeClass: Date,
  serialize: (_, value: Date, ctx) => ctx.done(value.toISOString()),
  deserialize: (_, value: string, ctx) => ctx.done(new Date(value)),
});

// Association list for demonstrating codec composition

class AssocList<K, V> implements TableCodec<typeof AssocList> {
  constructor(public unwrap: [K, V][]) {}

  public [$SerializeForTable](ctx: TableSerCtx) {
    return ctx.recurse(Object.fromEntries(this.unwrap));
  }

  public static [$DeserializeForTable](_: unknown, obj: Record<string, unknown>[], ctx: TableDesCtx, def: SomeDoc) {
    const values = Object.entries(obj);

    for (let i = 0; i < values.length; i++) {
      values[i][0] = ctx.codecs.type[def.keyType]?.deserialize(undefined, values[i][0], ctx, def)[1] ?? values[i][0];
      values[i][1] = ctx.codecs.type[def.valueType]?.deserialize(undefined, values[i][1], ctx, def)[1] ?? values[i][1];
    }

    return ctx.done(new AssocList(values));
  }
}

const AssocListCodec = TableCodecs.forType('map', AssocList);
