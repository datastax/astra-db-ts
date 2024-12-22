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

import { VectorizeServiceOptions } from '@/src/db';
import { WithTimeout } from '@/src/lib';
import { TableOptions } from '@/src/db/types/tables/spawn-table';

/**
 * Options for creating a new table (via {@link Db.createTable}).
 *
 * See {@link Db.createTable} & {@link Table} for more information.
 *
 * @field definition - The bespoke columns/primary-key definition for the table.
 * @field ifNotExists - Makes operation a no-op if the table already exists.
 * @field keyspace - Overrides the keyspace for the table (from the `Db`'s working keyspace).
 * @field embeddingApiKey - The embedding service's API-key/headers (for $vectorize)
 * @field timeoutDefaults - Default timeouts for all table operations
 * @field logging - Logging configuration overrides
 * @field serdes - Additional serialization/deserialization configuration
 * @field timeout - The timeout override for this method
 *
 * @public
 */
export interface CreateTableOptions<Def extends CreateTableDefinition = CreateTableDefinition> extends WithTimeout<'tableAdminTimeoutMs'>, TableOptions {
  definition: Def,
  ifNotExists?: boolean,
}

/**
 * The definition for creating a new table through the Data API, using a bespoke schema definition syntax.
 *
 * See {@link Db.createTable} for more info.
 *
 * @public
 */
export interface CreateTableDefinition {
  /**
   * The columns to create in the table.
   */
  readonly columns: CreateTableColumnDefinitions,
  /**
   * The primary key definition for the table.
   */
  readonly primaryKey: CreateTablePrimaryKeyDefinition,
}

/**
 * ##### Overview
 *
 * Represents the syntax for defining a new column through the bespoke Data API schema definition syntax, in which there
 * are two branching ways to define a column.
 *
 * @example
 * ```ts
 * await db.createTable('my_table', {
 *   definition: {
 *     columns: {
 *       id: 'uuid',
 *       name: { type: 'text' },
 *       set: { type: 'set', valueType: 'text' },
 *     },
 *     primaryKey: ...,
 *   },
 * });
 * ```
 *
 * ##### The "loose" column definition
 *
 * The loose column definition is a shorthand for the strict version, and follows the following example form:
 *
 * ```ts
 * columns: {
 *   textCol: 'text',
 *   uuidCol: 'uuid',
 * }
 * ```
 *
 * In this form, the key is the column name, and the value is the type of the scalar column.
 *
 * If you need to define a column with a more complex type (i.e. for maps, sets, lists, and vectors), you must use the strict column definition.
 *
 * Plus, while it still provides autocomplete, the loose column definition does not statically enforce the type of the column, whereas the strict column definition does.
 *
 * ##### The "strict" column definition
 *
 * The strict column definition is the more structured way to define a column, and follows the following example form:
 *
 * ```ts
 * columns: {
 *   uuidCol: { type: 'uuid' },
 *   mapCol: { type: 'map', keyType: 'text', valueType: 'int' },
 *   listCol: { type: 'list', valueType: 'text' },
 *   vectorCol: { type: 'vector', dimension: 3 },
 * }
 * ```
 *
 * In this form, the key is the column name, and the value is an object with a `type` field that specifies the type of the column.
 *
 * The object may also contain additional fields that are specific to the type of the column:
 * - For `map`, you _must_ specify the `keyType` and `valueType` fields.
 *   - The `keyType` must, for the time being, be either `'text'` or `'ascii'`.
 *   - The `valueType` must be a scalar type.
 * - For `list`s and `set`s, you _must_ specify the `valueType` field.
 *   - The `valueType` must be a scalar type.
 * - For `vector`s, you _must_ specify the `dimension` field.
 *   - You may optionally provide a `service` field to enable vectorize.
 *   - Note that you still need to create a vector index on the column to actually use vector search.
 *
 * @see LooseCreateTableColumnDefinition
 * @see StrictCreateTableColumnDefinition
 *
 * @public
 */
export type CreateTableColumnDefinitions = Record<string, LooseCreateTableColumnDefinition | StrictCreateTableColumnDefinition>;

/**
 * ##### Overview
 *
 * Represents the scalar types that can be used to define a column in a table.
 *
 * ##### Disclaimer
 *
 * _Note that there may be other scalar types not present in this union that have partial Data API support, but may not be created through the Data API (such as `timeuuid` or `varchar`)._
 *
 * @public
 */
export type TableScalarType =
  | 'ascii'
  | 'bigint'
  | 'blob'
  | 'boolean'
  | 'date'
  | 'decimal'
  | 'double'
  | 'duration'
  | 'float'
  | 'int'
  | 'inet'
  | 'smallint'
  | 'text'
  | 'time'
  | 'timestamp'
  | 'tinyint'
  | 'uuid'
  | 'varint';

/**
 * ##### Overview
 *
 * The loose column definition is a shorthand for the strict version, and follows the following example form:
 *
 * ```ts
 * columns: {
 *   textCol: 'text',
 *   uuidCol: 'uuid',
 * }
 * ```
 *
 * In this form, the key is the column name, and the value is the type of the scalar column.
 *
 * If you need to define a column with a more complex type (i.e. for maps, sets, lists, and vectors), you must use the strict column definition.
 *
 * Plus, while it still provides autocomplete, the loose column definition does not statically enforce the type of the column, whereas the strict column definition does.
 *
 * @public
 */
export type LooseCreateTableColumnDefinition =
  | TableScalarType
  | string;

/**
 * ##### Overview
 *
 * The strict column definition is the more structured way to define a column, and follows the following example form:
 *
 * ```ts
 * columns: {
 *   uuidCol: { type: 'uuid' },
 *   mapCol: { type: 'map', keyType: 'text', valueType: 'int' },
 *   listCol: { type: 'list', valueType: 'text' },
 *   vectorCol: { type: 'vector', dimension: 3 },
 * }
 * ```
 *
 * In this form, the key is the column name, and the value is an object with a `type` field that specifies the type of the column.
 *
 * The object may also contain additional fields that are specific to the type of the column:
 * - For `map`, you _must_ specify the `keyType` and `valueType` fields.
 *   - The `keyType` must, for the time being, be either `'text'` or `'ascii'`.
 *   - The `valueType` must be a scalar type.
 * - For `list`s and `set`s, you _must_ specify the `valueType` field.
 *   - The `valueType` must be a scalar type.
 * - For `vector`s, you _must_ specify the `dimension` field.
 *   - You may optionally provide a `service` field to enable vectorize.
 *   - Note that you still need to create a vector index on the column to actually use vector search.
 *
 * ##### The "loose" shorthand syntax
 *
 * If you're simply defining a scalar column, you can use the shorthand "loose" syntax instead, which is equivalent to the above for `uuidCol`:
 *
 * ```ts
 * columns: {
 *   uuidCol: 'uuid',
 * }
 * ```
 *
 * @public
 */
export type StrictCreateTableColumnDefinition =
  | ScalarCreateTableColumnDefinition
  | MapCreateTableColumnDefinition
  | ListCreateTableColumnDefinition
  | SetCreateTableColumnDefinition
  | VectorCreateTableColumnDefinition;

/**
 * ##### Overview
 *
 * Represents the "strict" column type definition for a scalar column.
 *
 * Of the example format:
 *
 * ```ts
 * columns: {
 *   uuidCol: { type: 'uuid' },
 *   textCol: { type: 'text' },
 * }
 * ```
 *
 * ##### The "loose" syntax
 *
 * If you prefer, you can use the shorthand "loose" syntax instead, which is equivalent to the above:
 *
 * ```ts
 * columns: {
 *   uuidCol: 'uuid',
 *   textCol: 'text',
 * }
 * ```
 *
 * The only difference is that the "loose" syntax does not statically enforce the type of the column, whereas the "strict" syntax does.
 *
 * However, the loose syntax still provides autocomplete for the scalar types' names.
 *
 * @see StrictCreateTableColumnDefinition
 *
 * @public
 */
export interface ScalarCreateTableColumnDefinition {
  type: TableScalarType,
}

/**
 * ##### Overview
 *
 * Represents the syntax for defining a `map` column in a table, which has no shorthand/"loose" equivalent.
 *
 * Of the example format:
 *
 * ```ts
 * columns: {
 *   mapCol: { type: 'map', keyType: 'text', valueType: 'int' },
 * }
 * ```
 *
 * This may then be used through `astra-db-ts` as a `Map<KeyType, ValueType>`:
 *
 * ```ts
 * await table.insertOne({
 *   mapCol: new Map([['key1', 1], ['key2', 2]]),
 * });
 * ```
 *
 * ##### The key type
 *
 * The `keyType` must, for the time being, be either `'text'` or `'ascii'`.
 *
 * Other fields, even those which are still represented as strings in the serialized JSON form (such as `uuid`) are not supported as key types.
 *
 * ##### The value type
 *
 * The `valueType` may be any scalar type, such as `'int'`, `'text'`, or `'uuid'`.
 *
 * Nested collection types are not supported.
 *
 * @example
 * ```ts
 * import { uuid } from '@datastax/astra-db-ts';
 *
 * await table.insertOne({
 *   mapCol: new Map([['key1', uuid(4)], ['key2', uuid(4)]]);
 * });
 * ```
 *
 * @public
 */
export interface MapCreateTableColumnDefinition {
  type: 'map',
  keyType: 'text' | 'ascii',
  valueType: TableScalarType,
}

/**
 * ##### Overview
 *
 * Represents the syntax for defining a `list` column in a table, which has no shorthand/"loose" equivalent.
 *
 * Of the example format:
 *
 * ```ts
 * columns: {
 *   listCol: { type: 'list', valueType: 'text' },
 * }
 * ```
 *
 * This may then be used through `astra-db-ts` as n `Array<ValueType>` (aka `ValueType[]`):
 *
 * ```ts
 * await table.insertOne({
 *   listCol: ['value1', 'value2', 'value3'],
 * });
 * ```
 *
 * ##### The value type
 *
 * The `valueType` may be any scalar type, such as `'int'`, `'text'`, or `'uuid'`.
 *
 * Nested collection types are not supported.
 *
 * @example
 * ```ts
 * import { uuid } from '@datastax/astra-db-ts';
 *
 * await table.insertOne({
 *   listCol: [uuid(4), uuid(4), uuid(7)],
 * });
 * ```
 *
 * @public
 */
export interface ListCreateTableColumnDefinition {
  type: 'list',
  valueType: TableScalarType,
}

/**
 * ##### Overview
 *
 * Represents the syntax for defining a `set` column in a table, which has no shorthand/"loose" equivalent.
 *
 * Of the example format:
 *
 * ```ts
 * columns: {
 *   setCol: { type: 'set', valueType: 'text' },
 * }
 * ```
 *
 * This may then be used through `astra-db-ts` as n `Set<ValueType>`:
 *
 * ```ts
 * await table.insertOne({
 *   setCol: new Set(['value1', 'value2', 'value3']),
 * });
 * ```
 *
 * ##### The value type
 *
 * The `valueType` may be any scalar type, such as `'int'`, `'text'`, or `'uuid'`.
 *
 * Nested collection types are not supported.
 *
 * @example
 * ```ts
 * import { uuid } from '@datastax/astra-db-ts';
 *
 * await table.insertOne({
 *   setCol: new Set([uuid(4), uuid(4), uuid(7)]),
 * });
 * ```
 *
 * @public
 */
export interface SetCreateTableColumnDefinition {
  type: 'set',
  valueType: TableScalarType,
}

/**
 * ##### Overview
 *
 * Represents the syntax for defining a `vector` column in a table, which has no shorthand/"loose" equivalent.
 *
 * Of the example format:
 *
 * ```ts
 * columns: {
 *   vectorCol: { type: 'vector', dimension: 3 },
 * }
 * ```
 *
 * This may then be used through `astra-db-ts` as a `DataAPIVector`:
 *
 * ```ts
 * import { vector } from '@datastax/astra-db-ts';
 *
 * await table.insertOne({
 *   vectorCol: vector([1, 2, 3]),
 * });
 *
 * // Or, if vectorize (auto-embedding-generation) is enabled:
 * await table.insertOne({
 *   vectorCol: 'Alice went to the beach',
 * });
 * ```
 *
 * Keep in mind though, that a vector index must still be created on this column (through {@link Table.createVectorIndex} or CQL directly) to enable vector search on this column.
 *
 * ##### The dimension
 *
 * The `dimension` must be a positive integer, and represents the number of elements in the vector.
 *
 * Note that, at the time of writing, the dimension must still be specified, even if a `service` block is present.
 *
 * ##### The service block
 *
 * You may specify the `service` block to enable vectorize (auto-embedding-generation) for the column.
 *
 * If this is configured, then you can pass a `string` to the vector column instead of a vector directly, and have the Data API automatically embed it for you, using the model of your choice.
 *
 * If the `service` field is present, then {@link InferTableSchema} will also type the column as `string | DataAPIVector | null` instead of just `DataAPIVector | null`.
 *
 * @see Table.createVectorIndex
 * @see DataAPIVector
 *
 * @public
 */
export interface VectorCreateTableColumnDefinition {
  type: 'vector',
  dimension: number,
  service?: VectorizeServiceOptions,
}

/**
 * ##### Overview
 *
 * Represents the syntax for defining the primary key of a table through the bespoke Data API schema definition syntax,
 * in which there are two branching ways to define the primary key.
 *
 * @example
 * ```ts
 * await db.createTable('my_table', {
 *   definition: {
 *     columns: ...,
 *     primaryKey: {
 *       partitionBy: ['pt_key'],
 *       partitionSort: { cl_key: 1 },
 *     },
 *   },
 * });
 * ```
 *
 * ##### The shorthand definition
 *
 * If your table only has a single partition key, then you can define the partition key as simply
 *
 * ```ts
 * primaryKey: 'pt_key',
 * ```
 *
 * This is equivalent to the following full definition:
 *
 * ```ts
 * primaryKey: {
 *   partitionBy: ['pt_key'],
 *   partitionSort: {}, // note that this field is also optional if it's empty
 * }
 * ```
 *
 * ##### The full definition
 *
 * If your table has multiple columns in its primary key, you may use the full primary key definition syntax to express that:
 *
 * ```ts
 * primaryKey: {
 *   partitionBy: ['pt_key1', 'pt_key2'],
 *   partitionSort: { cl_key1: 1, cl_key2: -1 },
 * }
 * ```
 *
 * A sort of `1` on the clustering column means ascending, and a sort of -1 means descending.
 *
 * Note that, if you don't have any clustering keys (partition sorts), you can omit the `partitionSort` field entirely:
 *
 * ```ts
 * primaryKey: {
 *   partitionBy: ['pt_key1', 'pt_key2'],
 * }
 * ```
 *
 * @see FullCreateTablePrimaryKeyDefinition
 *
 * @public
 */
export type CreateTablePrimaryKeyDefinition =
  | string
  | FullCreateTablePrimaryKeyDefinition;

/**
 * ##### Overview
 *
 * If your table has multiple columns in its primary key, you may use the full primary key definition syntax to express that:
 *
 * ```ts
 * primaryKey: {
 *   partitionBy: ['pt_key1', 'pt_key2'],
 *   partitionSort: { cl_key1: 1, cl_key2: -1 },
 * }
 * ```
 *
 * Note that, if you don't have any clustering keys (partition sorts), you can omit the `partitionSort` field entirely:
 *
 * ```ts
 * primaryKey: {
 *   partitionBy: ['pt_key1', 'pt_key2'],
 * }
 * ```
 *
 * A sort of `1` on the clustering column means ascending, and a sort of -1 means descending.
 *
 * ##### The shorthand syntax
 *
 * If your table definition only has a single partition key, and no clustering keys (partition sorts), you can use the shorthand syntax instead:
 *
 * ```ts
 * primaryKey: 'pt_key',
 * ```
 *
 * @public
 */
export interface FullCreateTablePrimaryKeyDefinition {
  readonly partitionBy: readonly string[],
  readonly partitionSort?: Record<string, 1 | -1>,
}
