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

import type { GenericInsertManyOptions, SomePKey } from '@/src/documents/index.js';

/**
 * ##### Overview
 *
 * The options for an `insertMany` command on a table.
 *
 * > **🚨Important:** The options depend on the `ordered` parameter. If `ordered` is `true`, then the `concurrency` option is not allowed.
 *
 * @example
 * ```ts
 * const result = await table.insertMany([
 *   { id: uuid.v4(), name: 'John' },
 *   { id: uuid.v7(), name: 'Jane' },
 * ], {
 *   ordered: true,
 *   timeout: 60000,
 * });
 * ```
 *
 * @example
 * ```ts
 * const result = await table.insertMany([
 *   { id: uuid.v4(), name: 'John' },
 *   { id: uuid.v7(), name: 'Jane' },
 * ], {
 *   concurrency: 16, // ordered implicitly `false` if unset
 * });
 * ```
 *
 * ---
 *
 * ##### Datatypes
 *
 * See {@link Table}'s documentation for information on the available datatypes for tables.
 *
 * @see Table.insertMany
 * @see TableInsertManyResult
 *
 * @public
 */
export type TableInsertManyOptions = GenericInsertManyOptions;

/**
 * ##### Overview
 *
 * Represents the result of an `insertMany` command on a {@link Table}.
 *
 * @example
 * ```ts
 * try {
 *   const result = await table.insertMany([
 *     { id: uuid.v4(), name: 'John'},
 *     { id: uuid.v7(), name: 'Jane'},
 *   ]);
 *   console.log(result.insertedIds);
 * } catch (e) {
 *   if (e instanceof TableInsertManyError) {
 *     console.log(e.insertedIds())
 *     console.log(e.errors())
 *   }
 * }
 * ```
 *
 * ---
 *
 * ##### The primary key type
 *
 * The type of the primary key of the table is inferred from the second type-param of the {@link Table}.
 *
 * If not set, it defaults to `Partial<RSchema>` to keep the result type consistent.
 *
 * > **💡Tip:** See the {@link SomePKey} type for more information, and concrete examples, on this subject.
 *
 * @see Table.insertMany
 * @see TableInsertManyOptions
 *
 * @public
 */
export interface TableInsertManyResult<PKey extends SomePKey> {
  /**
   * The primary key of the inserted (or upserted) row. These will be the same values as the primary keys which were present in the rows which were just inserted.
   *
   * See {@link TableInsertManyResult} for more information about the primary key.
   */
  insertedIds: PKey[],
  /**
   * The number of documents that were inserted into the table.
   *
   * This is **always** equal to the length of the `insertedIds` array.
   */
  insertedCount: number,
}
