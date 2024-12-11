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
 * @public
 */
export type CreateTableColumnDefinitions = Record<string, LooseCreateTableColumnDefinition | StrictCreateTableColumnDefinition>;

/**
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
 * @public
 */
export type LooseCreateTableColumnDefinition =
  | TableScalarType
  | string;

/**
 * @public
 */
export type StrictCreateTableColumnDefinition =
  | ScalarCreateTableColumnDefinition
  | MapCreateTableColumnDefinition
  | ListCreateTableColumnDefinition
  | SetCreateTableColumnDefinition
  | VectorCreateTableColumnDefinition;

/**
 * @public
 */
export interface ScalarCreateTableColumnDefinition {
  type: TableScalarType,
}

/**
 * @public
 */
export interface MapCreateTableColumnDefinition {
  type: 'map',
  keyType: TableScalarType,
  valueType: TableScalarType,
}

/**
 * @public
 */
export interface ListCreateTableColumnDefinition {
  type: 'list',
  valueType: TableScalarType,
}

/**
 * @public
 */
export interface SetCreateTableColumnDefinition {
  type: 'set',
  valueType: TableScalarType,
}

/**
 * @public
 */
export interface VectorCreateTableColumnDefinition {
  type: 'vector',
  dimension?: number,
  service?: VectorizeServiceOptions,
}

/**
 * @public
 */
export type CreateTablePrimaryKeyDefinition =
  | ShortCreateTablePrimaryKeyDefinition
  | FullCreateTablePrimaryKeyDefinition;

/**
 * @public
 */
export type ShortCreateTablePrimaryKeyDefinition = string;

/**
 * @public
 */
export interface FullCreateTablePrimaryKeyDefinition {
  readonly partitionBy: readonly string[],
  readonly partitionSort?: Record<string, 1 | -1>,
}
