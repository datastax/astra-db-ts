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

import { GenericUpdateOneOptions, GenericUpdateResult, KeyOf, SomeRow } from '@/src/documents';

/**
 * Options for an `updateOne` command on a table.
 *
 * @field upsert - If true, perform an insert if no rows match the filter.
 * @field sort - The sort order to pick which row to update if the filter selects multiple rows.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Table.updateOne
 *
 * @public
 */
export type TableUpdateOneOptions = GenericUpdateOneOptions;

/**
 * Represents the result of an `updateOne` command on a table.
 *
 * @example
 * ```typescript
 * const result = await table.updateOne({
 *   _id: 'abc'
 * }, {
 *   $set: { name: 'John' }
 * }, {
 *   upsert: true
 * });
 *
 * if (result.upsertedCount) {
 *   console.log(`Row with primary key ${JSON.stringify(result.upsertedId)} was upserted`);
 * }
 * ```
 *
 * @field matchedCount - The number of rows that matched the filter.
 * @field modifiedCount - The number of rows that were actually modified.
 * @field upsertedCount - The number of rows that were upserted.
 * @field upsertedId - The identifier of the upserted row if `upsertedCount > 0`.
 *
 * @see Table.updateOne
 *
 * @public
 */
export type TableUpdateOneResult<Schema extends SomeRow> = GenericUpdateResult<KeyOf<Schema>, 0 | 1>;
