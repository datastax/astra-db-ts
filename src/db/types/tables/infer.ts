// Copyright DataStax, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import type { Table } from '@/src/documents/tables/table.js';
import type {
  CreateTableColumnDefinitions,
  CreateTableDefinition,
  FullCreateTablePrimaryKeyDefinition,
  TablePrimaryKeyDefinition,
} from '@/src/db/types/tables/create.js';
import type { EmptyObj, LitUnion } from '@/src/lib/types.js';
import type {
  DataAPIBlob,
  DataAPIDate,
  DataAPIDuration,
  DataAPIInet,
  DataAPITime,
  FoundRow,
  SomeRow,
  UUID,
} from '@/src/documents/index.js';
import type { TypeErr } from '@/src/documents/utils.js';
import type { DataAPIVector } from '@/src/documents/datatypes/vector.js';
import type { BigNumber } from 'bignumber.js';

/**
 * ##### Overview
 *
 * Enumerates the possible source types from which a {@link Table}'s TypeScript type can be inferred using {@link InferTableSchema}-like utility types.
 *
 * This means that there are **multiple ways to infer a table's schema**, and the type system will **automatically pick the right one** based on the context in which it is used.
 *
 * ---
 *
 * ##### ✨Inferring from a {@link CreateTableDefinition} (recommended)
 *
 * The recommended way to infer the TS-type of the table is by using the {@link Table.schema} method to create a {@link CreateTableDefinition} object, and then using the {@link InferTableSchema}-like utility types to infer the TS-type from that object.
 *
 * This is recommended over the below inferring methods because this method:
 *   - Allows you to easily define your schemas separate of the table, outside a scoped async context
 *     - Mostly relevant for CJS users, since ESM users can use top-level _await_
 *   - Allows you to override the type of specific datatypes
 *     - (via {@link TableSchemaTypeOverrides})
 *   - Provides localized type errors if any primary keys don't use a valid column
 *     - Not possible with writing the schema inline in {@link Db.createTable}
 *
 * @example
 * ```ts
 * // Table.schema just validates the type of the definition
 * const UserSchema = Table.schema({
 *   columns: {
 *     id: 'text',
 *     dob: 'date',
 *     friends: { type: 'map', keyType: 'text', valueType: 'uuid' },
 *   },
 *   primaryKey: {
 *     partitionBy: ['id'],
 *     partitionSort: { dob: -1 }
 *   },
 * });
 *
 * // equivalent to:
 * // type User = {
 * //   id: string,
 * //   dob: DataAPIDate,
 * //   friends?: Map<string, UUID>, (optional since it's not in the primary key)
 * // }
 * type User = InferTableSchema<typeof UserSchema>;
 *
 * // equivalent to:
 * // type UserPK = Pick<User, 'id' | 'dob'>;
 * type UserPK = InferTablePrimaryKey<typeof mkTable>;
 *
 * // table :: Table<User, UserPK>
 * const table = await db.createTable<User, UserPK>('users', {
 *   definition: UserSchema,
 *   ifNotExists: true,
 * });
 * ```
 *
 * ---
 *
 * ##### Inferring from a {@link Table} instance
 *
 * You can also infer the schema from a {@link Table} instance directly, if necessary.
 *
 * This type provides flexible ways to infer a table’s schema—whether from a {@link Table} instance directly, a `Promise` resolving to a `Table`, or a function returning either of those.
 * - This flexibility is especially helpful in CJS environments, where tables are often created inside async functions.
 *
 * @example
 * ```ts
 * // ESM users can use top-level _await_ to create the table instance
 * // and the type may be declared globally without issue
 * const table = await db.createTable('users', {
 *   definition: {
 *     columns: ...,
 *     primaryKey: ...,
 *   }
 * });
 *
 * type User = InferTableSchema<typeof table>;
 * type UserPK = InferTablePrimaryKey<typeof table>;
 * ```
 *
 *
 * @example
 * ```ts
 * // CJS users may not be able to use top-level _await_ to create the table instance
 * // but may instead create a utility function to create the table instance
 * // and use the type of that function to infer the table's type globally
 * const mkUsersTable = async () => await db.createTable('users', {
 *   definition: ...,
 * });
 *
 * type User = InferTableSchema<typeof mkUsersTable>;
 * type UserPK = InferTablePrimaryKey<typeof mkUsersTable>;
 *
 * async function main() {
 *  const table = await mkUsersTable();
 * }
 * ```
 *
 * @see Table.schema
 * @see InferTableSchema
 * @see InferTablePrimaryKey
 * @see InferTableReadSchema
 *
 * @public
 */
export type InferrableTableSchema =
  | CreateTableDefinition
  | ((..._: any[]) => Promise<Table<SomeRow>>)
  | ((..._: any[]) => Table<SomeRow>)
  | Promise<Table<SomeRow>>
  | Table<SomeRow>;

/**
 * ##### Overview
 *
 * Provides a way to override the type of specific datatypes in the {@link InferTableSchema}-like utility types.
 *
 * ##### Use-case: Custom ser/des
 *
 * This is especially useful when working with custom ser/des, necessitating you to use a different type for a specific datatype.
 *
 * @example
 * ```ts
 * const BigIntAsBigNumberCodec = TableCodecs.forType('bigint', {
 *   deserialize: (value, ctx) => ctx.done(BigNumber(value)),
 * });
 *
 * const ProductSchema = Table.schema({
 *   columns: {
 *     id: 'bigint',
 *     description: 'text',
 *     price: 'bigint',
 *   },
 *   primaryKey: 'id',
 * });
 *
 * // type Product = {
 * //   id: BigNumber, (primary key is always non-null)
 * //   description?: string | null,
 * //   price?: BigNumber | null,
 * // }
 * type Product = InferTableSchema<typeof ProductSchema, { bigint: BigNumber | null }>;
 *
 * const table = await db.createTable('products', {
 *   definition: ProductSchema,
 *   serdes: {
 *     codecs: [BigIntAsBigNumberCodec],
 *   },
 * });
 * ```
 *
 * ##### Use-case: Removing `| null`
 *
 * If you really want a column to be non-null, you can use the `TypeOverrides` type to override the type of a specific datatype to be non-null.
 *
 * @example
 * ```ts
 * const ProductSchema = Table.schema({
 *   columns: {
 *     id: 'bigint',
 *     description: 'text',
 *     price: 'bigint',
 *   },
 *   primaryKey: 'id',
 * });
 *
 * // type Product = {
 * //   id: BigNumber, (primary key is always non-null)
 * //   description?: string,
 * //   price?: BigNumber,
 * // }
 * type Product = InferTableSchema<typeof ProductSchema, {
 *   bigint: BigNumber,
 *   text: string,
 * }>;
 * ```
 *
 * ##### Use-case: Adding datatypes
 *
 * You can also add typing support for a datatype which isn't yet supported by the client.
 *
 * @example
 * ```ts
 * const ProductSchema = Table.schema({
 *   columns: {
 *     id: 'bigint',
 *     description: 'text',
 *     price: 'super_duper_bigint',
 *   },
 *   primaryKey: 'id',
 * });
 *
 * // type Product = {
 * //   id: BigNumber,
 * //   description?: string,
 * //   price?: BigNumber,
 * // }
 * type Product = InferTableSchema<typeof ProductSchema, {
 *   super_duper_bigint: BigNumber,
 * }>;
 * ```
 *
 * ##### Overriding collection types
 *
 * > **🚨Important:** Because TypeScript does not _natively_ support higher-kinded types, it is not yet possible to **polymorphically** override the type of collection types (e.g. `list`, `set`, `map`).
 *
 * However, you can still technically override the type of a collection datatype monomorphically.
 *
 * @example
 * ```ts
 * const ExampleSchema = Table.schema({
 *   columns: {
 *     id: 'uuid',
 *     map: { type: 'map', keyType: 'text', valueType: 'int' },
 *   },
 *   primaryKey: 'id',
 * });
 *
 * // type Example = {
 * //   id: UUID,
 * //   map?: Record<string, number>,
 * // }
 * type Example = InferTableSchema<typeof ExampleSchema, {
 *   map: Map<string, number>,
 * }>;
 * ```
 *
 *
 * @public
 */
export type TableSchemaTypeOverrides = Partial<Record<LitUnion<keyof CqlNonGenericType2TSTypeDict | keyof CqlGenericType2TSTypeDict<any, any>>, unknown>>;

/**
 * ##### Overview
 *
 * Automagically extracts a table's schema from a {@link CreateTableDefinition} or some Table<Schema>-like type.
 * - You can think of it as similar to Zod or arktype's `infer<Schema>` types.
 * - This is most useful when creating a new table via {@link Db.createTable}.
 *
 * It accepts various different (contextually) isomorphic types to account for differences in instantiation & usage.
 *
 * > **💡Tip:** Please see {@link InferrableTableSchema} for the different ways to use this utility type, and see {@link TableSchemaTypeOverrides} for how to override the type of specific datatypes.
 *
 * > **✏️Note:** A DB's type information is inferred by `db.createTable` by default. To override this behavior, please provide the table's type explicitly to help with transpilation times (e.g. `db.createTable<SomeRow>(...)`).
 *
 * @example
 * ```ts
 * // Table.schema just validates the type of the definition
 * const UserSchema = Table.schema({
 *   columns: {
 *     id: 'text',
 *     dob: 'date',
 *     friends: { type: 'map', keyType: 'text', valueType: 'uuid' },
 *   },
 *   primaryKey: {
 *     partitionBy: ['id'],
 *     partitionSort: { dob: -1 }
 *   },
 * });
 *
 * // equivalent to:
 * // type User = {
 * //   id: string,
 * //   dob: DataAPIDate,
 * //   friends?: Map<string, UUID>, (optional since it's not in the primary key)
 * // }
 * type User = InferTableSchema<typeof UserSchema>;
 *
 * // equivalent to:
 * // type UserPK = Pick<User, 'id' | 'dob'>;
 * type UserPK = InferTablePrimaryKey<typeof mkTable>;
 *
 * // table :: Table<User, UserPK>
 * const table = await db.createTable<User, UserPK>('users', {
 *   definition: UserSchema,
 *   ifNotExists: true,
 * });
 * ```
 *
 * @see InferrableTableSchema
 * @see TableSchemaTypeOverrides
 * @see Table.schema
 * @see InferTablePrimaryKey
 * @see InferTableReadSchema
 *
 * @public
 */
export type InferTableSchema<T extends InferrableTableSchema, Overrides extends TableSchemaTypeOverrides = Record<never, never>> =
  T extends CreateTableDefinition
    ? InferTableSchemaFromDefinition<T, Overrides> :
    Record<never, never> extends Overrides
      ? T extends (..._: any[]) => Promise<Table<infer Schema, any, any>>
          ? Schema :
        T extends (..._: any[]) => Table<infer Schema, any, any>
          ? Schema :
        T extends Promise<Table<infer Schema, any, any>>
          ? Schema :
        T extends Table<infer Schema, any, any>
          ? Schema
          : never
      : 'ERROR: Can not provide TypeOverrides if not inferring the type from a CreateTableDefinition';

/**
 * ##### Overview
 *
 * Automagically extracts a table's primary key from a {@link CreateTableDefinition} or some Table<Schema>-like type.
 *
 * See {@link InferTableSchema} for more information & examples.
 *
 * @public
 */
export type InferTablePrimaryKey<T extends InferrableTableSchema, Overrides extends TableSchemaTypeOverrides = Record<never, never>> =
  T extends CreateTableDefinition
    ? InferTablePKFromDefinition<T, Overrides> :
  Record<never, never> extends Overrides
    ? T extends (..._: any[]) => Promise<Table<any, infer PKey, any>>
        ? PKey :
      T extends (..._: any[]) => Table<any, infer PKey, any>
        ? PKey :
      T extends Promise<Table<any, infer PKey, any>>
        ? PKey :
      T extends Table<any, infer PKey, any>
        ? PKey
        : never
    : 'ERROR: Can not provide TypeOverrides if not inferring the type from a CreateTableDefinition';

/**
 * ##### Overview
 *
 * Automagically extracts a table's read-schema from a {@link CreateTableDefinition} or some Table<Schema>-like type.
 *
 * See {@link InferTableSchema} for more information & examples.
 *
 * @public
 */
export type InferTableReadSchema<T extends InferrableTableSchema, Overrides extends TableSchemaTypeOverrides = Record<never, never>> =
  T extends CreateTableDefinition
    ? FoundRow<InferTableSchemaFromDefinition<T, Overrides>> :
  Record<never, never> extends Overrides
    ? T extends (..._: any[]) => Promise<Table<any, any, infer Schema>>
        ? Schema :
      T extends (..._: any[]) => Table<any, any, infer Schema>
        ? Schema :
      T extends Promise<Table<any, any, infer Schema>>
        ? Schema :
      T extends Table<any, any, infer Schema>
        ? Schema
        : never
    : 'ERROR: Can not provide TypeOverrides if not inferring the type from a CreateTableDefinition';

type Normalize<T> = { [K in keyof T]: T[K] } & EmptyObj;

type InferTableSchemaFromDefinition<FullDef extends CreateTableDefinition<FullDef>, Overrides extends TableSchemaTypeOverrides> = Normalize<MkColumnTypes<FullDef['columns'], MkPrimaryKeyType<FullDef, Cols2CqlTypes<FullDef['columns'], Overrides>>, Overrides>>;

type InferTablePKFromDefinition<FullDef extends CreateTableDefinition<FullDef>, Overrides extends TableSchemaTypeOverrides> = Normalize<MkPrimaryKeyType<FullDef, Cols2CqlTypes<FullDef['columns'], Overrides>>>;

type MkColumnTypes<Cols extends CreateTableColumnDefinitions, PK extends Record<string, any>, Overrides extends TableSchemaTypeOverrides> = {
  -readonly [P in keyof Cols as P extends keyof PK ? P : never]-?: CqlType2TSType<Cols[P], Overrides> & {};
} & {
  -readonly [P in keyof Cols as P extends keyof PK ? never : P]+?: CqlType2TSType<Cols[P], Overrides>;
}

type MkPrimaryKeyType<FullDef extends CreateTableDefinition, Schema, PK extends FullCreateTablePrimaryKeyDefinition<any> = NormalizePK<FullDef['primaryKey']>> = Normalize<
  {
    -readonly [P in PK['partitionBy'][number]]: P extends keyof Schema ? Schema[P] & {} : TypeErr<`Field \`${P & string}\` not found as property in table definition`>;
  }
  & (PK['partitionSort'] extends object
    ? {
      -readonly [P in keyof PK['partitionSort']]: P extends keyof Schema ? Schema[P] & {} : TypeErr<`Field \`${P & string}\` not found as property in table definition`>;
    }
    : EmptyObj)
>

type NormalizePK<PK extends TablePrimaryKeyDefinition<any>> =
  PK extends string
    ? { partitionBy: [PK] } :
  PK extends object
    ? PK
    : never;

type Cols2CqlTypes<Columns extends CreateTableColumnDefinitions, Overrides extends TableSchemaTypeOverrides> = {
  -readonly [P in keyof Columns]: CqlType2TSType<Columns[P], Overrides>;
};

/**
 * ##### Overview
 *
 * Converts a CQL type to its TS equivalent.
 *
 * This interprets both {@link StrictCreateTableColumnDefinition} and {@link LooseCreateTableColumnDefinition} equally.
 * - Though note that the former type _must_ be used for collection/`vector` types
 *
 * @example
 * ```ts
 * // number | null
 * CqlType2TSType<'int', ...>
 *
 * // DataAPIDuration  | null
 * CqlType2TSType<{ type: 'duration }, ...>
 *
 * // Map<string, number>
 * CqlType2TSType<{ type: 'map', keyType: 'text', valueType: 'int' }>
 *
 * // unknown
 * CqlType2TSType<'idk', ...>
 *
 * // TypeErr<`Invalid definition for 'map'; should be of format { ... }`>
 * CqlType2TSType<'map'>
 * ```
 *
 * ##### Getting rid of the `| null`
 *
 * As this type is intended primarily for internal usage within the {@link InferTableSchema}-like types, it will return `<type> | null` for all scalar values, as they all may be `null` when returned back from the Data API
 * - Collection types are excluded from this rule as, when returned from the Data API, they will just be set to their empty value.
 *
 * You can simply do `CqlType2TSType<...> & {}` to get rid of the `| null` type (or use type overrides as explained below).
 *
 * ##### Type overrides
 *
 * When working with custom ser/des, you may find it necessary to override the type of a specific datatype.
 *
 * See {@link TableSchemaTypeOverrides} for more information on this subject.
 *
 * @example
 * ```ts
 * // BigNumber | null
 * CqlType2TSType<'bigint', { bigint: BigNumber | null }>
 * ```
 *
 * @see InferTableSchema
 *
 * @public
 */
export type CqlType2TSType<Def extends CreateTableColumnDefinitions[string], Overrides extends TableSchemaTypeOverrides = Record<never, never>> =
  CqlType2TSTypeInternal<PickCqlType<Def>, Def, Overrides>

type PickCqlType<Def> =
  Def extends { type: infer Type }
    ? Type
    : Def;

type CqlType2TSTypeInternal<Type, Def, Overrides extends TableSchemaTypeOverrides> =
  Type extends keyof Overrides
    ? Overrides[Type] :
  Type extends keyof CqlNonGenericType2TSTypeDict
    ? CqlNonGenericType2TSTypeDict[Type] :
  Type extends keyof CqlGenericType2TSTypeDict<Def, Overrides>
    ? CqlGenericType2TSTypeDict<Def, Overrides>[Type]
    : unknown;

interface CqlNonGenericType2TSTypeDict {
  ascii: string | null,
  bigint: bigint | null,
  blob: DataAPIBlob | null,
  boolean: boolean | null,
  counter: bigint | null,
  date: DataAPIDate | null,
  decimal: BigNumber | null,
  double: number | null,
  duration: DataAPIDuration | null,
  float: number | null,
  int: number | null,
  inet: DataAPIInet | null,
  smallint: number | null,
  text: string | null;
  time: DataAPITime | null,
  timestamp: Date | null,
  timeuuid: UUID | null,
  tinyint: number | null,
  uuid: UUID | null,
  varchar: string | null,
  varint: bigint | null,
}

interface CqlGenericType2TSTypeDict<Def, Overrides extends TableSchemaTypeOverrides> {
  map: CqlMapType2TsType<Def, Overrides>,
  list: CqlListType2TsType<Def, Overrides>,
  set: CqlSetType2TsType<Def, Overrides>,
  vector: CqlVectorType2TsType<Def> | null,
}

type CqlMapType2TsType<Def, Overrides extends TableSchemaTypeOverrides> =
  Def extends { keyType: infer KeyType extends string, valueType: infer ValueType extends string }
    ? Map<CqlType2TSTypeInternal<KeyType, never, Overrides> & {}, CqlType2TSTypeInternal<ValueType, never, Overrides> & {}>
    : TypeErr<`Invalid definition for 'map'; should be of format { type: 'map', keyType: <scalar>, valueType: <scalar> }`>;

type CqlListType2TsType<Def, Overrides extends TableSchemaTypeOverrides> =
  Def extends { valueType: infer ValueType extends string }
    ? (CqlType2TSTypeInternal<ValueType, never, Overrides> & {})[]
    : TypeErr<`Invalid definition for 'list'; should be of format { type: 'list', valueType: <scalar> }`>;

type CqlSetType2TsType<Def, Overrides extends TableSchemaTypeOverrides> =
  Def extends { valueType: infer ValueType extends string }
    ? Set<CqlType2TSTypeInternal<ValueType, never, Overrides> & {}>
    : TypeErr<`Invalid definition for 'set'; should be of format { type: 'set', valueType: <scalar> }`>;

type CqlVectorType2TsType<Def> =
  Def extends { service: unknown }
    ? DataAPIVector | string
    : DataAPIVector;
