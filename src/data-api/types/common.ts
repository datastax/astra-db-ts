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

import { ObjectId, SomeDoc, UUID, WithId } from '@/src/data-api';
import type { ToDotNotation } from '@/src/data-api/types';

/**
 * @public
 */
export type SomeId = string | number | bigint | boolean | Date | UUID | ObjectId;

/**
 * Specifies the sort criteria for selecting documents.
 *
 * **If you want stricter type-checking and full auto-complete, see {@link StrictSort}.**
 *
 * Can use `1`/`-1` for ascending/descending, or `$vector` for sorting by vector distance.
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
 * @public
 */
export type Sort =
  | Record<string, 1 | -1>
  | { $vector: number[] }
  | { $vectorize: string };

/**
 * Specifies which fields should be included/excluded in the returned documents.
 *
 * **If you want stricter type-checking and full auto-complete, see {@link StrictProjection}.**
 *
 * Can use `1`/`0`, or `true`/`false`
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
export type Projection = Record<string, 1 | 0 | true | false | ProjectionSlice>;

/**
 * Specifies the sort criteria for selecting documents.
 *
 * Can use `1`/`-1` for ascending/descending, or `$vector` for sorting by vector distance.
 *
 * **NB. The order of the fields in the sort option is significant—fields are sorted in the order they are listed.**
 *
 * @example
 * ```typescript
 * // Sort by name in ascending order, then by age in descending order
 * await collection.findOne({}, {
 *   sort: {
 *     name: 1,
 *     age: -1,
 *   } satisfies StrictSort<SomeDoc>,
 * });
 *
 * // Sort by vector distance
 * await collection.findOne({}, {
 *   sort: {
 *     $vector: [0.23, 0.38, 0.27, 0.91, 0.21],
 *   } satisfies StrictSort<SomeDoc>,
 * });
 * ```
 *
 * @public
 */
export type StrictSort<Schema extends SomeDoc> =
  | { [K in keyof ToDotNotation<WithId<Schema>>]?: 1 | -1 }
  | { $vector: number[] }
  | { $vectorize: string };

/**
 * Specifies which fields should be included/excluded in the returned documents.
 *
 * Can use `1`/`0`, or `true`/`false`
 *
 * @example
 * ```typescript
 * await collection.findOne({}, {
 *   projection: {
 *     _id: 0,
 *     name: 1,
 *     'address.state': 1,
 *   } satisfies StrictProjection<SomeDoc>,
 * });
 *
 * await collection.findOne({}, {
 *   projection: {
 *     $vector: 0,
 *   } satisfies StrictProjection<SomeDoc>,
 * });
 *
 * await collection.findOne({}, {
 *   projection: {
 *     test_scores: { $slice: [2, 4] },
 *   } satisfies StrictProjection<SomeDoc>,
 * });
 * ```
 *
 * @public
 */
export type StrictProjection<Schema extends SomeDoc> = {
  [K in keyof ToDotNotation<WithId<Schema>>]?: any[] extends (ToDotNotation<WithId<Schema>>)[K]
    ? 1 | 0 | true | false | ProjectionSlice
    : 1 | 0 | true | false;
};

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
 * @public
 */
export interface ProjectionSlice {
  $slice: number | [number, number];
}