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
import type { EmptyObj } from '@/src/lib/types.js';
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
 * The different possible types that a Table's schema may be inferred from using the {@link InferTableSchema}-like types,
 * when using {@link Db.createTable} or {@link Table.alter}.
 *
 * @see InferTableSchema
 * @see InferTablePrimaryKey
 * @see InferTableReadSchema
 *
 * @public
 */
export type InferrableTable =
  | CreateTableDefinition
  | ((..._: any[]) => Promise<Table<SomeRow>>)
  | ((..._: any[]) => Table<SomeRow>)
  | Promise<Table<SomeRow>>
  | Table<SomeRow>;

export type TypeOverrides = Partial<Record<keyof CqlNonGenericType2TSTypeDict | keyof CqlGenericType2TSTypeDict<any, any>, unknown>>;

/**
 * Automagically extracts a table's schema from some Table<Schema>-like type, most useful when performing a
 * {@link Db.createTable} (or {@link Table.alter}) operation.
 *
 * You can think of it as similar to Zod or arktype's `infer<Schema>` types.
 *
 * Accepts various different (contextually) isomorphic types to account for differences in instantiation & usage:
 * - `CreateTableDefinition`
 * - `(...) => Promise<Table<infer Schema>>`
 * - `(...) => Table<infer Schema>`
 * - `Promise<Table<infer Schema>>`
 * - `Table<infer Schema>`
 *
 * A DB's type information is inferred by `db.createTable` by default. To override this
 * behavior, please provide the table's type explicitly to help with transpilation times (e.g.
 * `db.createTable<SomeRow>(...)`).
 *
 * @example
 * ```ts
 * const UserSchema = Table.schema({
 *   definition: {
 *     columns: {
 *       name: 'text',
 *       dob: {
 *         type: 'timestamp',
 *       },
 *       friends: {
 *         type: 'set',
 *         valueType: 'text',
 *       },
 *     },
 *     primaryKey: {
 *       partitionBy: ['name', 'height'],
 *       partitionSort: { dob: 1 },
 *     },
 *   },
 * });
 *
 * // Type inference is as simple as that
 * type User = InferTableSchema<typeof UserSchema>;
 * type UserPK = InferTablePrimaryKey<typeof UserSchema>;
 *
 * // Utility types for demonstration purposes
 * type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
 * type Expect<T extends true> = T;
 *
 * // User evaluates to this object representing its TS representation
 * // for the table's schema
 * type _Proof = Equal<User, {
 *   name: string,
 *   dob: Date,
 *   friends: Set<string>,
 * }>;
 *
 * // UserPK evaluates to this object representing its TS representation
 * // for `insert*` operations' return types
 * type _ProofPK = Equal<UserPK, {
 *   name: string,
 *   height: TypeErr<'Field `height` not found as property in table definition'>,
 *   dob: Date,
 * }>;
 *
 * // And now `User` can be used wherever.
 * const main = async () => {
 *   const table: Table<User> = await db.createTable('users', {
 *     definition: UserSchema,
 *   });
 *   const found: User | null = await table.findOne({});
 * };
 * ```
 *
 * @public
 */
export type InferTableSchema<T extends InferrableTable, Overrides extends TypeOverrides = Record<never, never>> =
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
 * Automagically extracts a table's primary key from some Table<Schema>-like type, most useful when performing a
 * {@link Db.createTable} (or {@link Table.alter}) operation.
 *
 * See {@link InferTableSchema} for more information & examples.
 *
 * @public
 */
export type InferTablePrimaryKey<T extends InferrableTable, Overrides extends TypeOverrides = Record<never, never>> =
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
 * Automagically extracts a table's read-schema from some Table<Schema>-like type, most useful when performing a
 * {@link Db.createTable} (or {@link Table.alter}) operation.
 *
 * See {@link InferTableSchema} for more information & examples.
 *
 * @public
 */
export type InferTableReadSchema<T extends InferrableTable, Overrides extends TypeOverrides = Record<never, never>> =
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

type InferTableSchemaFromDefinition<FullDef extends CreateTableDefinition<FullDef>, Overrides extends TypeOverrides> = Normalize<MkColumnTypes<FullDef['columns'], MkPrimaryKeyType<FullDef, Cols2CqlTypes<FullDef['columns'], Overrides>>, Overrides>>;

type InferTablePKFromDefinition<FullDef extends CreateTableDefinition<FullDef>, Overrides extends TypeOverrides> = Normalize<MkPrimaryKeyType<FullDef, Cols2CqlTypes<FullDef['columns'], Overrides>>>;

type MkColumnTypes<Cols extends CreateTableColumnDefinitions, PK extends Record<string, any>, Overrides extends TypeOverrides> = {
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

type Cols2CqlTypes<Columns extends CreateTableColumnDefinitions, Overrides extends TypeOverrides> = {
  -readonly [P in keyof Columns]: CqlType2TSType<Columns[P], Overrides>;
};

/**
 * Converts a CQL type to its TS equivalent. If the type isn't some collection type, the second typeparam is
 * irrelevant.
 *
 * @example
 * ```ts
 * // number
 * CqlType2TSType<'int', ...>
 *
 * // DataAPIDuration
 * CqlType2TSType<'duration', ...>
 *
 * // Map<string, number>
 * CqlType2TSType<'map', { keyType: 'text', valueType: 'int' }>
 *
 * // unknown
 * CqlType2TSType<'idk', ...>
 *
 * // TypeErr<'Invalid generics definition for \'map\'; should have keyType and valueType set as scalar CQL types (e.g. \'text\')'>
 * CqlType2TSType<'map', 123>
 * ```
 *
 * @see InferTableSchema
 * @see InferTablePrimaryKey
 *
 * @public
 */
export type CqlType2TSType<Def extends CreateTableColumnDefinitions[string], Overrides extends TypeOverrides = Record<never, never>> =
  CqlType2TSTypeInternal<PickCqlType<Def>, Def, Overrides>

type PickCqlType<Def> =
  Def extends { type: infer Type }
    ? Type
    : Def;

type CqlType2TSTypeInternal<Type, Def, Overrides extends TypeOverrides> =
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

interface CqlGenericType2TSTypeDict<Def, Overrides extends TypeOverrides> {
  map: CqlMapType2TsType<Def, Overrides>,
  list: CqlListType2TsType<Def, Overrides>,
  set: CqlSetType2TsType<Def, Overrides>,
  vector: CqlVectorType2TsType<Def> | null,
}

type CqlMapType2TsType<Def, Overrides extends TypeOverrides> =
  Def extends { keyType: infer KeyType extends string, valueType: infer ValueType extends string }
    ? Map<CqlType2TSTypeInternal<KeyType, never, Overrides> & {}, CqlType2TSTypeInternal<ValueType, never, Overrides> & {}>
    : TypeErr<'Invalid generics definition for \'map\'; should have keyType and valueType set as scalar CQL types (e.g. \'text\')'>;

type CqlListType2TsType<Def, Overrides extends TypeOverrides> =
  Def extends { valueType: infer ValueType extends string }
    ? (CqlType2TSTypeInternal<ValueType, never, Overrides> & {})[]
    : TypeErr<'Invalid generics definition for \'list\'; should have valueType set as scalar CQL types (e.g. \'text\')'>;

type CqlSetType2TsType<Def, Overrides extends TypeOverrides> =
  Def extends { valueType: infer ValueType extends string }
    ? Set<CqlType2TSTypeInternal<ValueType, never, Overrides> & {}>
    : TypeErr<'Invalid generics definition for \'set\'; should have valueType set as scalar CQL types (e.g. \'text\')'>;

type CqlVectorType2TsType<Def> =
  Def extends { service: unknown }
    ? DataAPIVector | string
    : DataAPIVector;
