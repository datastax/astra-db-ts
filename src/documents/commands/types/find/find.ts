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

import type { Projection, Sort, WithDeprecatedVectorSortOptions } from '@/src/documents/index.js';
import type { CommandOptions } from '@/src/lib/index.js';

/**
 * ##### Overview
 *
 * The options for a generic `find` command performed on the Data API.
 *
 * @example
 * ```ts
 * const results = await collection.find({
 *   category: 'electronics',
 * }, {
 *   sort: { price: 1 },
 *   limit: 10,
 *   timeout: 10000,
 * });
 * ```
 * ---
 *
 * ##### Builder methods
 *
 * You can also use fluent builder methods on the cursor:
 *
 * @example
 * ```ts
 * const cursor = collection.find({ category: 'electronics' })
 *   .sort({ price: 1 })
 *   .limit(10)
 *   .skip(5);
 *
 * const results = await cursor.toArray();
 * ```
 *
 * @see CollectionFindOptions
 * @see TableFindOptions
 *
 * @public
 */
export interface GenericFindOptions extends CommandOptions<{ timeout: 'generalMethodTimeoutMs' }>, WithDeprecatedVectorSortOptions {
  /**
   * The order in which to apply the update if the filter selects multiple records.
   *
   * See {@link FindCursor.sort} for more details and examples.
   */
  sort?: Sort,
  /**
   * The projection to apply to the returned records, to specify only a select set of fields to return.
   *
   * See {@link FindCursor.project} for more details and examples.
   */
  projection?: Projection,
  /**
   * The maximum number of records to return in the lifetime of the cursor.
   *
   * See {@link FindCursor.limit} for more details and examples.
   */
  limit?: number,
  /**
   * The number of records to skip before starting to return records.
   *
   * See {@link FindCursor.skip} for more details and examples.
   */
  skip?: number,
  /**
   * If true, include the similarity score in the result via the `$similarity` field.
   *
   * See {@link FindCursor.includeSimilarity} for more details and examples.
   */
  includeSimilarity?: boolean;
  /**
   * If true, the sort vector will be available through `await cursor.getSortVector()` and `await cursor.fetchNextPage()`.
   *
   * See {@link FindCursor.getSortVector} for more details and examples.
   */
  includeSortVector?: boolean,
  /**
   * Sets the starting page state for the cursor.
   *
   * See {@link FindCursor.initialPageState} for more details and examples.
   */
  initialPageState?: string | null,
}
