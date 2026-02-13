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

import type { SomeDoc } from '@/src/documents/index.js';
import type { IsDate, IsNum } from '@/src/documents/types/utils.js';

/**
 * Represents the update filter to specify how to update a document.
 *
 * @example
 * ```typescript
 * const updateFilter: CollectionUpdateFilter<SomeDoc> = {
 *   $set: {
 *     'customer.name': 'Jim B.'
 *   },
 *   $unset: {
 *     'customer.phone': ''
 *   },
 *   $inc: {
 *     'customer.age': 1
 *   },
 * }
 * ```
 *
 * @field $set - Set the value of a field in the document.
 * @field $setOnInsert - Set the value of a field in the document if an upsert is performed.
 * @field $unset - Remove the field from the document.
 * @field $inc - Increment the value of a field in the document.
 * @field $push - Add an element to an array field in the document.
 * @field $pop - Remove an element from an array field in the document.
 * @field $rename - Rename a field in the document.
 * @field $currentDate - Set the value of a field to the current date.
 * @field $min - Only update the field if the specified value is less than the existing value.
 * @field $max - Only update the field if the specified value is greater than the existing value.
 * @field $mul - Multiply the value of a field in the document.
 * @field $addToSet - Add an element to an array field in the document if it does not already exist.
 *
 * @public
 */
export interface CollectionUpdateFilter<Schema extends SomeDoc> {
  /**
   * Set the value of a field in the document.
   *
   * @example
   * ```typescript
   * const updateFilter: CollectionUpdateFilter<SomeDoc> = {
   *   $set: {
   *     'customer.name': 'Jim B.'
   *   }
   * }
   * ```
   */
  $set?: Partial<Schema> & SomeDoc,
  /**
   * Set the value of a field in the document if an upsert is performed.
   *
   * @example
   * ```typescript
   * const updateFilter: CollectionUpdateFilter<SomeDoc> = {
   *   $setOnInsert: {
   *     'customer.name': 'Jim B.'
   *   }
   * }
   * ```
   */
  $setOnInsert?: Partial<Schema> & SomeDoc,
  /**
   * Remove the field from the document.
   *
   * @example
   * ```typescript
   * const updateFilter: CollectionUpdateFilter<SomeDoc> = {
   *   $unset: {
   *     'customer.phone': ''
   *   }
   * }
   * ```
   */
  $unset?: Record<string, '' | true | 1>,
  /**
   * Increment the value of a field in the document if it's potentially a `number`.
   *
   * @example
   * ```typescript
   * const updateFilter: CollectionUpdateFilter<SomeDoc> = {
   *   $inc: {
   *     'customer.age': 1
   *   }
   * }
   * ```
   */
  $inc?: CollectionNumberUpdate<Schema> & Record<string, number>,
  /**
   * Add an element to an array field in the document.
   *
   * @example
   * ```typescript
   * const updateFilter: CollectionUpdateFilter<SomeDoc> = {
   *   $push: {
   *     'items': 'Extended warranty - 5 years'
   *   }
   * }
   * ```
   */
  $push?: CollectionPush<Schema> & SomeDoc,
  /**
   * Remove an element from an array field in the document.
   *
   * @example
   * ```typescript
   * const updateFilter: CollectionUpdateFilter<SomeDoc> = {
   *   $pop: {
   *     'items': -1
   *   }
   * }
   * ```
   */
  $pop?: CollectionPop<Schema> & Record<string, number>,
  /**
   * Rename a field in the document.
   *
   * @example
   * ```typescript
   * const updateFilter: CollectionUpdateFilter<SomeDoc> = {
   *   $rename: {
   *     'customer.name': 'client.name'
   *   }
   * }
   * ```
   */
  $rename?: Record<string, string>,
  /**
   * Set the value of a field to the current date.
   *
   * @example
   * ```typescript
   * const updateFilter: CollectionUpdateFilter<SomeDoc> = {
   *   $currentDate: {
   *     'purchase_date': true
   *   }
   * }
   * ```
   */
  $currentDate?: CollectionCurrentDate<Schema> & Record<string, boolean>,
  /**
   * Only update the field if the specified value is less than the existing value.
   *
   * @example
   * ```typescript
   * const updateFilter: CollectionUpdateFilter<SomeDoc> = {
   *   $min: {
   *     'customer.age': 18
   *   }
   * }
   * ```
   */
  $min?: (CollectionNumberUpdate<Schema> | CollectionDateUpdate<Schema>) & Record<string, number | bigint | Date | { $date: number }>,
  /**
   * Only update the field if the specified value is greater than the existing value.
   *
   * @example
   * ```typescript
   * const updateFilter: CollectionUpdateFilter<SomeDoc> = {
   *   $max: {
   *     'customer.age': 65
   *   }
   * }
   * ```
   */
  $max?: (CollectionNumberUpdate<Schema> | CollectionDateUpdate<Schema>) & Record<string, number | bigint | Date | { $date: number }>,
  /**
   * Multiply the value of a field in the document.
   *
   * @example
   * ```typescript
   * const updateFilter: CollectionUpdateFilter<SomeDoc> = {
   *   $mul: {
   *     'customer.age': 1.1
   *   }
   * }
   * ```
   */
  $mul?: CollectionNumberUpdate<Schema> & Record<string, number>,
  /**
   * Add an element to an array field in the document if it does not already exist.
   *
   * @example
   * ```typescript
   * const updateFilter: CollectionUpdateFilter<SomeDoc> = {
   *   $addToSet: {
   *     'items': 'Extended warranty - 5 years'
   *   }
   * }
   * ```
   */
  $addToSet?: CollectionPush<Schema> & SomeDoc,
}

/**
 * Weaker version os StrictPop which allows for more flexibility in typing pop operations.
 *
 * @public
 */
export type CollectionPop<Schema> = {
  [K in keyof CollectionArrayUpdate<Schema>]?: number
}

/**
 * Weaker version of StrictPush which allows for more flexibility in typing push operations.
 *
 * @public
 */
export type CollectionPush<Schema> = {
  [K in keyof CollectionArrayUpdate<Schema>]?: (
    | CollectionArrayUpdate<Schema>[K]
    | { $each: CollectionArrayUpdate<Schema>[K][], $position?: number }
  )
}

/**
 * Weaker version of StrictNumberUpdate which allows for more flexibility in typing number update operations.
 *
 * @public
 */
export type CollectionNumberUpdate<Schema> = {
  [K in keyof Schema as IsNum<Schema[K]> extends true ? K : never]?: number | bigint
}

/**
 * Weaker version of StrictDateUpdate which allows for more flexibility in typing date update operations.
 *
 * @public
 */
export type CollectionDateUpdate<Schema> = {
  [K in keyof Schema as ContainsDate<Schema[K]> extends true ? K : never]?: Date | { $date: number }
};

/**
 * Types some array operations. Not inherently strict or weak.
 *
 * @public
 */
export type CollectionArrayUpdate<Schema> = {
  [K in keyof Schema as any[] extends Schema[K] ? K : never]?: PickArrayTypes<Schema[K]>
};

/**
 * Types the $currentDate operation. Not inherently strict or weak.
 *
 * @public
 */
export type CollectionCurrentDate<Schema> =  {
  [K in keyof Schema as Schema[K] extends Date | { $date: number } ? K : never]?: boolean
};

/**
 * Checks if the schema contains a date type.
 *
 * @public
 */
export type ContainsDate<Schema> = IsDate<Schema[keyof Schema]>;

/**
 * Picks the array types from a type that may be an array.
 *
 * @public
 */
export type PickArrayTypes<Schema> = Extract<Schema, any[]> extends (infer E)[] ? E : never;
