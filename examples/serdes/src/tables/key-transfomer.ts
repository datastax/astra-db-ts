import { Camel2SnakeCase, Db } from '@datastax/astra-db-ts';

export async function TableKeyTransformerExample(name: string, db: Db) {
  // As far as the client is concerned, the keys in the document are in camelCase
  interface TableSchema {
    userId: string,
    fullName: string,
    birthday: Date,
  }

  // Note that the columns still need to be defined in snake_case
  const table = await db.createTable<TableSchema>(name, {
    definition: {
      columns: {
        user_id: 'text',
        full_name: 'text',
        birthday: 'timestamp',
      },
      primaryKey: 'user_id',
    },
    serdes: {
      keyTransformer: new Camel2SnakeCase(),
    },
  });

  // Outside of ser/des-ing a document, row, [update] filter, etc.,
  // the key transformer will not be used.
  await table.createIndex('name_idx', 'full_name');

  // Insert & find the document using camelCase keys
  const inserted = await table.insertOne({
    userId: 'alice123',
    fullName: 'Alice W. Land',
    birthday: new Date('1990-01-01'),
  });

  // { userId: 'alice123' }
  console.log('Found inserted key in camelCase', inserted.insertedId);

  // { userId: 'alice123', fullName: 'Alice W. Land', birthday: Date('1990-01-01') }
  const found = await table.findOne({ fullName: 'Alice W. Land' });
  console.log('Found row in camelCase', found);

  // However, if we try accessing the same document through a table without a key transformer,
  // we'll need to use explicit snake_case keys
  const tableRaw = db.table(name);

  // { _id: 'alice123', full_name: 'Alice W. Land', birthday: Date('1990-01-01') }
  const foundRaw = await tableRaw.findOne({ full_name: 'Alice W. Land'});
  console.log('Found row in raw snake_case', foundRaw);
}
