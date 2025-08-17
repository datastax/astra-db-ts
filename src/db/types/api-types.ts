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

import type {
  DataAPIBlob,
  DataAPIDate,
  DataAPIDuration,
  DataAPIInet,
  DataAPITime,
  DataAPIVector, SomeRow, UUID,
} from '@/src/documents/index.js';
import type { CreateTableColumnDefinitions, TableSchemaInferenceOverrides } from '@/src/db/index.js';
import type { BigNumber } from 'bignumber.js';
import type { TypeErr } from '@/src/documents/utils.js';

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
 * // DataAPIDuration | null
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
 * ---
 *
 * ##### Getting rid of the `| null`
 *
 * As this type is intended primarily for internal usage within the {@link InferTableSchema}-like types, it will return `<type> | null` for all scalar values, as they all may be `null` when returned back from the Data API
 * - Collection types are excluded from this rule as, when returned from the Data API, they will just be set to their empty value.
 *
 * You can do `CqlType2TSType<...> & {}` to get rid of the `| null` type (or use type overrides as explained below).
 *
 * ---
 *
 * ##### Type overrides
 *
 * When working with custom ser/des, you may find it necessary to override the type of specific datatypes.
 *
 * See {@link TableSchemaInferenceOverrides} for more information on this subject.
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
export type DataAPIType2TSType<Def extends CreateTableColumnDefinitions[string], TypeOverrides extends TableSchemaInferenceOverrides['typeOverrides'] = Record<never, never>> =
  CqlType2TSTypeInternal<NormalizeTypeFormat<Def>, Def, TypeOverrides>

type NormalizeTypeFormat<Def> =
  Def extends { type: infer Type }
    ? Type
    : Def;

type CqlType2TSTypeInternal<Type, Def, TypeOverrides extends TableSchemaInferenceOverrides['typeOverrides']> =
  Type extends keyof TypeOverrides
    ? TypeOverrides[Type] :
  Type extends keyof CqlScalarTypeMap
    ? CqlScalarTypeMap[Type] :
  Type extends keyof CqlCollectionTypeMap<Def, TypeOverrides>
    ? CqlCollectionTypeMap<Def, TypeOverrides>[Type]
    : unknown;

/**
 * ##### Overview
 *
 * Represents the scalar types that can be used to define a column in a table.
 *
 * ---
 *
 * ##### Disclaimer
 *
 * _Note that there may be other scalar types not present in this union that have partial Data API support, but may not be created through the Data API (such as `timeuuid` or `varchar`)._
 *
 * @public
 */
export type DataAPICreatableScalarTypes = Exclude<keyof CqlScalarTypeMap, 'counter' | 'timeuuid' | 'varchar'>;

/**
 * ##### Overview
 *
 * Represents all the available Data API types that the current version of the client is aware of.
 *
 * @public
 */
export type DataAPITypes = keyof CqlScalarTypeMap | keyof CqlCollectionTypeMap<any, any>;

interface CqlScalarTypeMap {
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

interface CqlCollectionTypeMap<Def, TypeOverrides extends TableSchemaInferenceOverrides['typeOverrides']> {
  map: CqlMapType2TsType<Def, TypeOverrides>,
  list: CqlListType2TsType<Def, TypeOverrides>,
  set: CqlSetType2TsType<Def, TypeOverrides>,
  vector: CqlVectorType2TsType<Def> | null,
  userDefined: CqlUserDefinedType2TsType<Def, TypeOverrides> | null,
}

type CqlMapType2TsType<Def, TypeOverrides extends TableSchemaInferenceOverrides['typeOverrides']> =
  Def extends { keyType: infer KeyType extends string, valueType: infer ValueType extends string }
    ? Map<CqlType2TSTypeInternal<KeyType, never, TypeOverrides> & {}, CqlType2TSTypeInternal<ValueType, never, TypeOverrides> & {}>
    : TypeErr<`Invalid definition for 'map'; should be of format { type: 'map', keyType: <scalar>, valueType: <scalar> }`>;

type CqlListType2TsType<Def, TypeOverrides extends TableSchemaInferenceOverrides['typeOverrides']> =
  Def extends { valueType: infer ValueType extends string }
    ? (CqlType2TSTypeInternal<ValueType, never, TypeOverrides> & {})[]
    : TypeErr<`Invalid definition for 'list'; should be of format { type: 'list', valueType: <scalar> }`>;

type CqlSetType2TsType<Def, TypeOverrides extends TableSchemaInferenceOverrides['typeOverrides']> =
  Def extends { valueType: infer ValueType extends string }
    ? Set<CqlType2TSTypeInternal<ValueType, never, TypeOverrides> & {}>
    : TypeErr<`Invalid definition for 'set'; should be of format { type: 'set', valueType: <scalar> }`>;

type CqlVectorType2TsType<Def> =
  Def extends { service: unknown }
    ? DataAPIVector | string
    : DataAPIVector;

type CqlUserDefinedType2TsType<Def, TypeOverrides extends TableSchemaInferenceOverrides['typeOverrides']> =
  Def extends { udtName: infer UDTName extends string }
    ? UDTName extends keyof TypeOverrides
      ? TypeOverrides[UDTName]
      : SomeRow
    : TypeErr<`Invalid definition for 'userDefined'; should be of format { type: 'userDefined', udtName: '<name>' }`>;
