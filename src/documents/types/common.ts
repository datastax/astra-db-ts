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

import type { DataAPIVector, SomeDoc } from '@/src/documents/index.js';

/**
 * Allowed types to specify an ascending or descending sort.
 *
 * @public
 */
export type SortDirection = 1 | -1;

/**
 * Specifies the sort criteria for selecting documents.
 *
 * Can use `1`/`-1` for ascending/descending, or `$vector` for sorting by vector distance.
 *
 * See {@link SortDirection} for all possible sort values.
 *
 * **NB. The order of the fields in the sort option is significant—fields are sorted in the order they are listed.**
 *
 * @example
 * ```typescript
 * // Sort by name in ascending order, then by age in descending order
 * const sort1: Sort = {
 *   name: 1,
 *   age: -1,
 * }
 *
 * // Sort by vector distance
 * const sort2: Sort = {
 *   $vector: [0.23, 0.38, 0.27, 0.91, 0.21],
 * }
 * ```
 *
 * @see SortDirection
 *
 * @public
 */
export type Sort = Record<string, SortDirection | string | number[] | DataAPIVector>;

/**
 * Specifies which fields should be included/excluded in the returned documents.
 *
 * Can use `1`/`0`, or `true`/`false`.
 *
 * There's a special field `'*'` that can be used to include/exclude all fields.
 *
 * @example
 * ```typescript
 * // Include _id, name, and address.state
 * const projection1: Projection = {
 *   _id: 0,
 *   name: 1,
 *   'address.state': 1,
 * }
 *
 * // Exclude the $vector
 * const projection2: Projection = {
 *   $vector: 0,
 * }
 *
 * // Return array indices 2, 3, 4, and 5
 * const projection3: Projection = {
 *   test_scores: { $slice: [2, 4] },
 * }
 * ```
 *
 * @public
 */
export type Projection = Record<string, 1 | 0 | boolean | ProjectionSlice>;

/**
 * Specifies the number of elements in an array to return in the query result.
 *
 * Has one of the following forms:
 * ```
 * // Return the first two elements
 * { $slice: 2 }
 *
 * // Return the last two elements
 * { $slice: -2 }
 *
 * // Skip 4 elements (from 0th index), return the next 2
 * { $slice: [4, 2] }
 *
 * // Skip backward 4 elements, return next 2 elements (forward)
 * { $slice: [-4, 2] }
 * ```
 *
 * @example
 * ```typescript
 * await collections.insertOne({ arr: [1, 2, 3, 4, 5] });
 *
 * // Return [1, 2]
 * await collections.findOne({}, {
 *   projection: {
 *     arr: { $slice: 2 },
 *   },
 * });
 *
 * // Return [3, 4]
 * await collections.findOne({}, {
 *   projection: {
 *     arr: { $slice: [-3, 2] },
 *   },
 * });
 * ```
 *
 * @public
 */
export interface ProjectionSlice {
  /**
   * Either of the following:
   * - A positive integer to return the first N elements
   * - A negative integer to return the last N elements
   * - A tuple of two integers to skip the first N elements and return the next M elements
   */
  $slice: number | [number, number];
}

/**
 * Adds `$similarity?: number` to the given type, representing the vector similarity score of the document if a vector search was performed.
 *
 * @public
 */
export type WithSim<Schema extends SomeDoc> = Schema & { $similarity?: number };
