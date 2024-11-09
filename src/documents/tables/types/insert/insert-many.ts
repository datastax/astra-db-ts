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

import type { GenericInsertManyOptions, KeyOf, SomeRow } from '@/src/documents';

/**
 * Options for an `insertMany` command on a table.
 *
 * The parameters depend on the `ordered` option. If `ordered` is `true`, the `parallel` option is not allowed.
 *
 * @field ordered - If `true`, the rows are inserted sequentially; else, they're arbitrary inserted in parallel.
 * @field concurrency - The maximum number of concurrent requests to make at once.
 * @field chunkSize - The number of rows to upload per request. Defaults to 50.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Table.insertMany
 *
 * @public
 */
export type TableInsertManyOptions = GenericInsertManyOptions;

/**
 * Represents the result of an `insertMany` command on a table.
 *
 * @field insertedIds - The primary keys of the inserted rows.
 * @field insertedCount - The number of inserted rows.
 *
 * @see Table.insertMany
 *
 * @public
 */
export interface TableInsertManyResult<Schema extends SomeRow> {
  /**
   * The primary keys of the inserted rows.
   */
  insertedIds: KeyOf<Schema>[],
  /**
   * The number of inserted rows (equals `insertedIds.length`).
   */
  insertedCount: number,
}
