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

import type { SomeRow } from '@/src/documents/index.js';
import type { CreateTableColumnDefinitions, RerankingServiceOptions, VectorizeServiceOptions } from '@/src/db/index.js';
import type { WithTimeout } from '@/src/lib/index.js';

/**
 * Options for altering a table.
 *
 * @public
 */
export interface AlterTableOptions<Schema extends SomeRow> extends WithTimeout<'tableAdminTimeoutMs'> {
  /**
   * The operations to perform on the table. Must pick just one of `add`, `drop`, `addVectorize`, or `dropVectorize`.
   */
  operation: AlterTableOperations<Schema>,
  // ifExists?: boolean,
}

/**
 * The possible alterations that may be performed on the table. Only one out of the four may be used at a time.
 *
 * @public
 */
export interface AlterTableOperations<Schema extends SomeRow> {
  add?: AddColumnOperation,
  drop?: DropColumnOperation<Schema>,
  addVectorize?: AddVectorizeOperation<Schema>,
  dropVectorize?: DropVectorizeOperation<Schema>,
  addReranking?: AddRerankingOperation,
  dropReranking?: DropRerankingOperation,
}

/**
 * An operation to add columns to the table.
 *
 * @public
 */
export interface AddColumnOperation {
  /**
   * The columns to add to the table, of the same format as in `createTable`
   */
  columns: CreateTableColumnDefinitions,
  // ifNotExists?: boolean,
}

/**
 * An operation to drop columns from the table.
 *
 * @public
 */
export interface DropColumnOperation<Schema extends SomeRow> {
  /**
   * The columns to drop from the table.
   */
  columns: (keyof Schema & string)[],
  // ifExists?: boolean,
}

/**
 * An operation to enable vectorize (auto-embedding-generation) on existing vector columns on the table.
 *
 * @public
 */
export interface AddVectorizeOperation<Schema extends SomeRow> {
  /**
   * The options for vectorize-ing each column.
   */
  columns: Partial<Record<keyof Schema & string, VectorizeServiceOptions>>,
  // ifNotExists?: boolean,
}

/**
 * An operation to disable vectorize (auto-embedding-generation) on existing vector columns on the table.
 *
 * @public
 */
export interface DropVectorizeOperation<Schema extends SomeRow> {
  /**
   * The columns to disable vectorize on.
   */
  columns: (keyof Schema & string)[],
  // ifExists?: boolean,
}

/**
 * @public
 */
export interface AddRerankingOperation {
  service: RerankingServiceOptions,
}

/**
 * @public
 */
export type DropRerankingOperation = Record<never, never>;
