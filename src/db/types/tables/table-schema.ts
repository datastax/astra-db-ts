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

import type { $PrimaryKeyType } from '@/src/documents';
import { Table } from '@/src/documents/tables/table';
import {
  CreateTableColumnDefinitions,
  CreateTableDefinition,
  CreateTablePrimaryKeyDefinition,
  FullCreateTablePrimaryKeyDefinition,
} from '@/src/db/types/tables/create-table';
import { EmptyObj } from '@/src/lib/types';
import { UUID, InetAddress, CqlDate, CqlDuration, CqlTime, CqlTimestamp, CqlBlob } from '@/src/documents';
import { TypeErr } from '@/src/documents/utils';
import { DataAPIVector } from '@/src/documents/datatypes/vector';
import BigNumber from 'bignumber.js';

/**
 * The different possible types that a Table's schema may be inferred from using the {@link InferTableSchema} type,
 * when using {@link Db.createTable} or {@link Table.alter}.
 *
 * @see InferTableSchema
 *
 * @public
 */
export type InferrableTable =
  | CreateTableDefinition
  | ((..._: any[]) => Promise<Table>)
  | ((..._: any[]) => Table)
  | Promise<Table>
  | Table;

/**
 * Automagically extracts a table's schema from some Table<Schema>-like type, most useful when performing a
 * {@link Db.createTable} (or {@link Table.alter}) operation.
 *
 * You can think of it as similar to Zod or arktype's `infer<Schema>` types.
 *
 * Accepts various different (contextually) isomorphic types to account for differences in instantiation & usage:
 * - `(...) => Promise<Table<infer Schema>>`
 * - `(...) => Table<infer Schema>`
 * - `Promise<Table<infer Schema>>`
 * - `Table<infer Schema>`
 *
 * **NOTE:** A DB's type information is encoded by `db.createTable` & `table.alter` by default. To override this
 * behavior, please provide the table's type explicitly to help with transpilation times (e.g.
 * `db.createTable<SomeRow>(...)` or `table.alter<MyNewSchema>()`).
 *
 * @example
 * ```ts
 * import { $PrimaryKeyType, ... } from '@datastax/astra-db-ts';
 *
 * const mkUserTable = () => db.createTable('users', {
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
 * type User = InferTableSchema<typeof mkUserTable>;
 *
 * // Utility types for demonstration purposes
 * type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
 * type Expect<T extends true> = T;
 *
 * // User evaluates to this object representing its TS representation, and a `'$PrimaryKeyType'` key
 * // for type inference purposes for `insert*` operations
 * type _Proof = Equal<User, {
 *   name: string,
 *   dob: CqlTimestamp,
 *   friends: Set<string>,
 *   [$PrimaryKeyType]?: {
 *     name: string,
 *     height: TypeErr<'Field `height` not found as property in table definition'>,
 *     dob: CqlTimestamp,
 *   }
 * }>;
 *
 * // And now `User` can be used wherever.
 * const main = async () => {
 *   const table: Table<User> = await mkUserTable();
 *   const found: User | null = await table.findOne({});
 * };
 * ```
 *
 * @see InferTableSchemaFromDefinition
 *
 * @public
 */
export type InferTableSchema<T extends InferrableTable> =
  T extends CreateTableDefinition
    ? InferTableSchemaFromDefinition<T> :
  T extends (..._: any[]) => Promise<Table<infer Schema>>
    ? Schema :
  T extends (..._: any[]) => Table<infer Schema>
    ? Schema :
  T extends Promise<Table<infer Schema>>
    ? Schema :
  T extends Table<infer Schema>
    ? Schema
    : never;

export type Normalize<T> = { [K in keyof T]: T[K] } & EmptyObj;

/**
 * Automagically infers a table's schema and primary keys from the bespoke table definition given in
 * {@link Db.createTable} (or {@link Table.alter}).
 *
 * You can think of it as similar to Zod or arktype's `infer<Schema>` types.
 *
 * Likely, you're looking for the {@link InferTableSchema} type for use in your own codebase, as this infers the schema
 * directly from a `CreateTableDefinition` rather than from the`Table<Schema>` itself.
 *
 * @example
 * ```ts
 * import { $PrimaryKeyType, ... } from '@datastax/astra-db-ts';
 *
 * // The <const> cast is important here
 * const UserTableDefinition = <const>{
 *   columns: {
 *     name: 'text',
 *     dob: {
 *       type: 'timestamp',
 *     },
 *     friends: {
 *       type: 'set',
 *       valueType: 'text',
 *     },
 *   },
 *   primaryKey: {
 *     partitionBy: ['name', 'height'],
 *     partitionSort: { dob: 1 },
 *   },
 * };
 *
 * // Type inference is as simple as that
 * type User = InferTableSchemaFromDefinition<typeof UserTableDefinition>;
 *
 * // Utility types for demonstration purposes
 * type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
 * type Expect<T extends true> = T;
 *
 * // User evaluates to this object representing its TS representation, and a `'$PrimaryKeyType'` key
 * // for type inference purposes for `insert*` operations
 * type _Proof = Equal<User, {
 *   name: string,
 *   dob: CqlTimestamp,
 *   friends: Set<string>,
 *   [$PrimaryKeyType]?: {
 *     name: string,
 *     height: TypeErr<'Field `height` not found as property in table definition'>,
 *     dob: CqlTimestamp,
 *   }
 * }>;
 *
 * // And now `User` can be used wherever.
 * const main = async () => {
 *   const table: Table<User> = await db.createTable('users', { definition: UserTableDefinition });
 *   const found: User | null = await table.findOne({});
 * };
 * ```
 *
 * @see InferTableSchema
 *
 * @public
 */
export type InferTableSchemaFromDefinition<FullDef extends CreateTableDefinition> = Normalize<MkColumnTypes<FullDef['columns'], MkPrimaryKeyType<FullDef, Cols2CqlTypes<FullDef['columns']>>> & {
  [$PrimaryKeyType]?: MkPrimaryKeyType<FullDef, Cols2CqlTypes<FullDef['columns']>>,
}>

type MkColumnTypes<Cols extends CreateTableColumnDefinitions, PK extends Record<string, any>> = {
  -readonly [P in keyof Cols as P extends keyof PK ? P : never]-?: CqlType2TSType<PickCqlType<Cols[P]>, Cols[P]>;
} & {
  -readonly [P in keyof Cols as P extends keyof PK ? never : P]+?: CqlType2TSType<PickCqlType<Cols[P]>, Cols[P]> | null;
}

type MkPrimaryKeyType<FullDef extends CreateTableDefinition, Schema, PK extends FullCreateTablePrimaryKeyDefinition = NormalizePK<FullDef['primaryKey']>> = Normalize<
  {
    -readonly [P in PK['partitionBy'][number]]: P extends keyof Schema ? Schema[P] : TypeErr<`Field \`${P}\` not found as property in table definition`>;
  }
  & (PK['partitionSort'] extends object
    ? {
      -readonly [P in keyof PK['partitionSort']]: P extends keyof Schema ? Schema[P] : TypeErr<`Field \`${P & string}\` not found as property in table definition`>;
    }
    : EmptyObj)
>

type NormalizePK<PK extends CreateTablePrimaryKeyDefinition> =
  PK extends string
    ? { partitionBy: [PK] }
    : PK;

/**
 * @internal
 */
export type Cols2CqlTypes<Columns extends CreateTableColumnDefinitions> = {
  -readonly [P in keyof Columns]: CqlType2TSType<PickCqlType<Columns[P]>, Columns[P]>;
};

type PickCqlType<Def> =
  Def extends { type: infer Type }
    ? Type
    : Def;

/**
 * Converts a CQL type to its TS equivalent. If the type isn't some collection type, the second typeparam is
 * irrelevant.
 *
 * @example
 * ```ts
 * // number
 * CqlType2TSType<'int', ...>
 *
 * // CqlDuration
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
 * @see InferTableSchemaFromDefinition
 *
 * @public
 */
export type CqlType2TSType<T extends string, Def> =
  T extends keyof CqlNonGenericType2TSTypeDict
    ? CqlNonGenericType2TSTypeDict[T] :
  T extends keyof CqlGenericType2TSTypeDict<Def>
    ? CqlGenericType2TSTypeDict<Def>[T]
    : unknown;

interface CqlNonGenericType2TSTypeDict {
  ascii: string,
  bigint: number,
  blob: CqlBlob,
  boolean: boolean,
  date: CqlDate,
  decimal: BigNumber,
  double: number,
  duration: CqlDuration,
  float: number,
  int: number,
  inet: InetAddress,
  smallint: number,
  text: string;
  time: CqlTime,
  timestamp: CqlTimestamp,
  tinyint: number,
  uuid: UUID,
  varchar: string,
  varint: bigint,
  vector: DataAPIVector,
}

interface CqlGenericType2TSTypeDict<Def> {
  map: CqlMapType2TsType<Def>,
  list: CqlListType2TsType<Def>,
  set: CqlSetType2TsType<Def>,
}

type CqlMapType2TsType<Def> =
  Def extends { keyType: infer KeyType extends string, valueType: infer ValueType extends string }
    ? Map<CqlType2TSType<KeyType, never>, CqlType2TSType<ValueType, never>>
    : TypeErr<'Invalid generics definition for \'map\'; should have keyType and valueType set as scalar CQL types (e.g. \'text\')'>;

type CqlListType2TsType<Def> =
  Def extends { valueType: infer ValueType extends string }
    ? Array<CqlType2TSType<ValueType, never>>
    : TypeErr<'Invalid generics definition for \'list\'; should have valueType set as scalar CQL types (e.g. \'text\')'>;

type CqlSetType2TsType<Def> =
  Def extends { valueType: infer ValueType extends string }
    ? Set<CqlType2TSType<ValueType, never>>
    : TypeErr<'Invalid generics definition for \'set\'; should have valueType set as scalar CQL types (e.g. \'text\')'>;
