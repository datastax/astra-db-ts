import { SomeDoc } from '@/src/documents';
import { VectorizeServiceOptions } from '@/src/db';

const db = { createTable };

// Demo of automagically creating a primary key type for your manually created schema
interface Users extends TableSchema<Users, ['key', 'age']> {
  key: string,
  age: number,
  car: string,
}

const _a: TableKey<Users> = {
  key: 'abc',
  age: 31,
};

// Demo of the lawless world of weak typing
const _b: TableKey<SomeDoc> = {
  some: 'thing',
  any: 'thing',
};

// Demo of automagically inferring your table schema's type
const _c = createTable('my_table', {
  columns: {
    key: 'text',
    age: {
      type: 'int',
    },
    car: {
      type: 'map',
      keyType: 'text',
      valueType: 'int',
    },
  },
  primaryKey: 'key',
});

const _d: InferTableSchema<typeof _c> = {
  key: 'a',
  age: 3,
  car: new Map(),
  [__primaryKeyType]: {
    key: '1',
  },
};

// Demo of type errors that we can provide if you screw something up
const _e = createTable('my_table', {
  columns: {
    key: 'int',
  },
  primaryKey: 'id',
});

const _f: InferTableSchema<typeof _e> = {
  key: 1,
  [__primaryKeyType]: {
    id: 'ERROR: Field `id` not found as property in table definition',
  },
};

// Demo of manually providing your own table schema
const _g = createTable<SomeDoc>('my_table', {
  columns: {},
  primaryKey: 'id',
});

const _h: InferTableSchema<typeof _g> = {
  whatever: 'I want',
};

// Better demo of automagically inferring your table schema's type
const mkTable = () => db.createTable('my_table', {
  columns: {
    key: 'text',
    age: {
      type: 'int',
    },
    car: {
      type: 'map',
      keyType: 'text',
      valueType: 'int',
    },
  },
  primaryKey: {
    partitionKey: ['key', 'bad'],
    partitionSort: { age: -1 },
  },
});

type MySchema = InferTableSchema<typeof mkTable>;

type Proof = Expect<Equal<MySchema, {
  key: string,
  age: number,
  car: Map<string, number>,
} & {
  [__primaryKeyType]?: {
    key: string,
    bad: 'ERROR: Field `bad` not found as property in table definition',
  } & {
    age: number,
  },
}>>;

// insertMany example
(async () => {
  const myTable = await mkTable();

  const insertManyResult = myTable.insertMany<MySchema>([
    {
      age: 3,
      car: new Map(),
      key: '3',
    },
    {
      age: 53,
      car: new Map(),
      key: 'hiii',
    },
  ]);

  type __ = Expect<Equal<typeof insertManyResult, {
    insertedIds: ({
      key: string,
      bad: 'ERROR: Field `bad` not found as property in table definition',
    } & {
      age: number,
    })[],
  }>> & Proof;

  console.log(insertManyResult.insertedIds[1].age);
})();

// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------
// ------------------------------------------ WARNING: DARK MAGIC BELOW ------------------------------------------------

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
export type Expect<T extends true> = T;

declare const __primaryKeyType: unique symbol;

interface TableSchema<Schema extends SomeDoc, PrimaryKey extends (keyof Schema)[]> {
  [__primaryKeyType]?: {
    [P in PrimaryKey[number]]: Schema[P];
  };
}

type SomeTableKey = Record<string, unknown>;

type TableKey<Schema extends SomeDoc> = Schema extends { [__primaryKeyType]?: infer PrimaryKey }
  ? PrimaryKey extends SomeTableKey
    ? PrimaryKey
    : SomeTableKey
  : SomeTableKey;

export type InferrableTable =
  | ((..._: any[]) => Promise<Table>)
  | ((..._: any[]) => Table)
  | CreateTableDefinition
  | Promise<Table>
  | Table;

export type InferTableSchema<T extends InferrableTable> =
  T extends (..._: any[]) => Promise<Table<infer Schema>>
    ? Schema :
  T extends (..._: any[]) => Table<infer Schema>
    ? Schema :
  T extends CreateTableDefinition
    ? InferTableSchemaFromDefinition<T> :
  T extends Promise<Table<infer Schema>>
    ? Schema :
  T extends Table<infer Schema>
    ? Schema
    : never;

function createTable<_ extends 'infer', const Def extends CreateTableDefinition>(_: string, __: Def): Promise<Table<InferTableSchemaFromDefinition<Def>>>

function createTable<T extends SomeDoc>(_: string, __: CreateTableDefinition): Promise<Table<T>>

function createTable(_: string, __: CreateTableDefinition): unknown {
  throw 'stub';
}

export type InferTableSchemaFromDefinition<FullDef extends CreateTableDefinition, Schema = _InferTableSchemaFromDefinition<FullDef>, PK extends FullCreateTablePrimaryKeyDefinition = NormalizePK<FullDef['primaryKey']>> = Schema & {
  [__primaryKeyType]?: {
    [P in PK['partitionKey'][number]]: P extends keyof Schema ? Schema[P] : `ERROR: Field \`${P}\` not found as property in table definition`;
  } & (PK['partitionSort'] extends Record<string, 1 | -1> ? {
      -readonly [P in keyof PK['partitionSort']]: P extends keyof Schema ? Schema[P] : `ERROR: Field \`${P & string}\` not found as property in table definition`;
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Intersection w/ {} is a "noop" here
  } : {}),
}

export type NormalizePK<PK extends CreateTablePrimaryKeyDefinition> =
  PK extends string
    ? { partitionKey: [PK] }
    : PK;

export type _InferTableSchemaFromDefinition<FullDef extends CreateTableDefinition> = {
  -readonly [P in keyof FullDef['columns']]: CqlType2TSType<InferColDefType<FullDef['columns'][P]>, FullDef['columns'][P]>;
};

export type InferColDefType<Def> =
  Def extends { type: infer Type }
    ? Type
    : Def;

export type CqlType2TSType<T, Def> =
  T extends 'text' | 'ascii' | 'varchar'
    ? string :
  T extends 'int' | 'double' | 'float' | 'smallint' | 'tinyint'
    ? number :
  T extends 'boolean'
    ? boolean :
  T extends 'varint'
    ? bigint :
  T extends 'map'
    ? CqlMapType2TsType<Def> :
  T extends 'list' | 'vector'
    ? CqlListType2TsType<Def> :
  T extends 'set'
    ? CqlSetType2TsType<Def>
    : unknown;

export type CqlMapType2TsType<Def> =
  Def extends { keyType: infer KeyType, valueType: infer ValueType }
    ? Map<CqlType2TSType<KeyType, never>, CqlType2TSType<ValueType, never>>
    : never;

export type CqlListType2TsType<Def> =
  Def extends { valueType: infer ValueType }
    ? Array<CqlType2TSType<ValueType, never>>
    : never;

export type CqlSetType2TsType<Def> =
  Def extends { valueType: infer ValueType }
    ? Set<CqlType2TSType<ValueType, never>>
    : never;

export interface CreateTableDefinition {
  columns: Record<string, CreateTableColumnDefinition>,
  primaryKey: CreateTablePrimaryKeyDefinition,
}

export type CreateTableColumnDefinition =
  | LooseCreateTableColumnDefinition
  | StrictCreateTableColumnDefinition

export type TableScalarType =
  | 'text'
  | 'int'
  | 'double'
  | 'float'
  | 'ascii'
  | 'smallint'
  | 'tinyint'
  | 'varchar'
  | 'varint'
  | 'boolean';

export type LooseCreateTableColumnDefinition =
  | TableScalarType
  | string;

export type StrictCreateTableColumnDefinition =
  | ScalarCreateTableColumnDefinition
  | MapCreateTableColumnDefinition
  | ListCreateTableColumnDefinition
  | SetCreateTableColumnDefinition
  | VectorCreateTableColumnDefinition;

export interface ScalarCreateTableColumnDefinition {
  type: TableScalarType,
}

export interface MapCreateTableColumnDefinition {
  type: 'map',
  keyType: TableScalarType,
  valueType: TableScalarType,
}

export interface ListCreateTableColumnDefinition {
  type: 'list',
  valueType: TableScalarType,
}

export interface SetCreateTableColumnDefinition {
  type: 'set',
  valueType: TableScalarType,
}

export interface VectorCreateTableColumnDefinition {
  type: 'vector',
  valueType: TableScalarType,
  dimensions?: number[],
  service: VectorizeServiceOptions,
}

export type CreateTablePrimaryKeyDefinition =
  | ShortCreateTablePrimaryKeyDefinition
  | FullCreateTablePrimaryKeyDefinition;

export type ShortCreateTablePrimaryKeyDefinition = string;

export interface FullCreateTablePrimaryKeyDefinition {
  partitionKey: string[],
  partitionSort?: Record<string, 1 | -1>,
}

interface TableInsertManyResult<Schema extends SomeDoc> {
  insertedIds: TableKey<Schema>[];
}

class Table<_Schema extends SomeDoc = SomeDoc> {
  insertMany<Schema extends SomeDoc>(_: Schema[]): TableInsertManyResult<Schema> {
    throw 'stub';
  }
}
