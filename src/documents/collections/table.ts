import { SomeDoc, VectorizeServiceOptions } from '@/src/data-api/index';

// Demo of automagically creating a primary key type for your manually created schema
interface Users extends TableSchema<Users, [['key'], 'age']> {
  key: string,
  age: number,
  car: string,
}

const _a: TableKey<Users> = {
  partitionKey: {
    key: 'abc',
  },
  clusteringKey: {
    age: 31,
  },
};

// Demo of the lawless world of weak typing
const _b: TableKey<SomeDoc> = {
  partitionKey: {
    some: 'thing',
  },
  clusteringKey: {
    any: 'thing',
  },
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
    partitionKey: {
      key: '1',
    },
    clusteringKey: {},
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
    partitionKey: {
      id: 'ERROR: Field id not found as property in table definition',
    },
    clusteringKey: {},
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
const _myTable = createTable('my_table', {
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
    partitionKey: ['key', 'yek'],
    partitionSort: { age: -1 },
  },
});

type MySchema = InferTableSchema<typeof _myTable>;

type _ = Expect<Equal<MySchema, {
  key: string,
  age: number,
  car: Map<string, number>,
} & {
  [__primaryKeyType]?: {
    partitionKey: {
      key: string,
      yek: 'ERROR: Field yek not found as property in table definition',
    },
    clusteringKey: {
      age: number,
    },
  },
}>>;

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

type Tail<List extends [any, ...any[]]> = List extends readonly [any, ...infer Tail] ? Tail : [];

interface TableSchema<Schema extends SomeDoc, PrimaryKey extends [(keyof Schema)[], ...(keyof Schema)[]]> {
  [__primaryKeyType]?: {
    partitionKey: {
      [P in PrimaryKey[0][number]]: Schema[P];
    },
    clusteringKey: {
      [P in Tail<PrimaryKey>[number]]: Schema[P];
    },
  };
}

// interface TableSchema<Schema extends SomeDoc, PrimaryKey extends [(keyof Schema)[], ...(keyof Schema)[]]> {
//   [__primaryKeyType]?: {
//     partitionKey: BuildKey<Schema, PrimaryKey[0]>,
//     clusteringKey: BuildKey<Schema, Tail<PrimaryKey>>,
//   };
// }
//
// type BuildKey<Schema extends Record<string, string>, Key extends unknown[]> =
//   Key extends [infer Head, ...infer Rest]
//     ? Head extends keyof Schema
//       ? [Schema[Head], ...BuildKey<Schema, Rest>]
//       : never
//     : [];

interface SomeTableKey {
  partitionKey: Record<string, unknown>;
  clusteringKey: Record<string, unknown>;
}

type TableKey<Schema extends SomeDoc> = Schema extends { [__primaryKeyType]?: infer PrimaryKey }
  ? PrimaryKey extends SomeTableKey
    ? PrimaryKey
    : SomeTableKey
  : SomeTableKey;

export type InferTableSchema<T extends Table<SomeDoc>> = T extends Table<infer Schema>
  ? Schema
  : never;

function createTable<_ extends 'infer', const Def extends CreateTableDefinition>(_: string, __: Def): Table<InferTableSchemaFromDefinition<Def>>

function createTable<T extends SomeDoc>(_: string, __: CreateTableDefinition): Table<T>

function createTable(_: string, __: CreateTableDefinition): unknown {
  throw 'stub';
}

export type InferTableSchemaFromDefinition<FullDef extends CreateTableDefinition, Schema = _InferTableSchemaFromDefinition<FullDef>, PK extends FullCreateTablePrimaryKeyDefinition = NormalizePK<FullDef['primaryKey']>> = Schema & {
  [__primaryKeyType]?: {
    partitionKey: {
      [P in PK['partitionKey'][number]]: P extends keyof Schema ? Schema[P] : `ERROR: Field ${P} not found as property in table definition`;
    },
    clusteringKey: PK['partitionSort'] extends Record<string, 1 | -1> ? {
      -readonly [P in keyof PK['partitionSort']]: P extends keyof Schema ? Schema[P] : `ERROR: Field ${P & string} not found as property in table definition`;
    } : Record<string, never>,
  };
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
  T extends 'text'
    ? string :
  T extends 'int'
    ? number :
  T extends 'map'
    ? CqlMapType2TsType<Def> :
  T extends 'list'
    ? CqlListType2TsType<Def> :
  T extends 'vector'
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
  | ShortCreateTableColumnDefinition
  | FullCreateTableColumnDefinition

export type TableScalarType =
  | 'text'
  | 'int';

export type ShortCreateTableColumnDefinition =
  | TableScalarType
  | string;

export type FullCreateTableColumnDefinition =
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

class Table<_Schema extends SomeDoc> {

}
