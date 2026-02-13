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

import type { CollectionArrayUpdate, CollectionPush, SomeDoc, SomeRow } from '@/src/documents/index.js';

/**
 * Represents the update filter to specify how to update a row.
 *
 * @example
 * ```typescript
 * const updateFilter: TableUpdateFilter<SomeDoc> = {
 *   $set: {
 *     'customer': 'Jim B.'
 *   },
 *   $unset: {
 *     'customer': ''
 *   },
 * }
 * ```
 *
 * @field $set - Set the value of a field in the row.
 * @field $unset - Remove the field from the row.
 *
 * @public
 */
export interface TableUpdateFilter<Schema extends SomeRow> {
  /**
   * Set the value of a field in the row.
   *
   * @example
   * ```typescript
   * const updateFilter: TableUpdateFilter<SomeDoc> = {
   *   $set: {
   *     'customer.name': 'Jim B.'
   *   }
   * }
   * ```
   */
  $set?: Partial<Schema> & SomeRow,
  /**
   * Remove the field from the row.
   *
   * @example
   * ```typescript
   * const updateFilter: TableUpdateFilter<SomeDoc> = {
   *   $unset: {
   *     'customer.phone': ''
   *   }
   * }
   * ```
   */
  $unset?: Record<string, '' | true | 1>,  /**
   * Add an element to an array field in the row.
   *
   * @example
   * ```typescript
   * const updateFilter: TableUpdateFilter<SomeDoc> = {
   *   $push: {
   *     'items': 'Extended warranty - 5 years'
   *   }
   * }
   * ```
   */
  $push?: TablePush<Schema> & SomeDoc,
  $pullAll?: TablePullAll<Schema> & SomeDoc,
}

/**
 * Weaker version of StrictPush which allows for more flexibility in typing push operations.
 *
 * @public
 */
export type TablePush<Schema> = CollectionPush<Schema>;

/**
 * Weaker version of StrictPullAll which allows for more flexibility in typing pull operations.
 *
 * @public
 */
export type TablePullAll<Schema> = CollectionArrayUpdate<Schema>; // TODO update documentation
