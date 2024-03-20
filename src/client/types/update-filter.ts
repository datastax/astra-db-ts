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

import type { SomeDoc, TypeErr } from '@/src/client';
import type { IsDate, IsNum, ToDotNotation } from '@/src/client/types';

export interface UpdateFilter<Schema extends SomeDoc> {
  $set?: Partial<Schema> & SomeDoc,
  $setOnInsert?: Partial<Schema> & SomeDoc,
  $min?: (NumberUpdate<Schema> | DateUpdate<Schema>) & Record<string, number | bigint | Date | { $date: number }>,
  $max?: (NumberUpdate<Schema> | DateUpdate<Schema>) & Record<string, number | bigint | Date | { $date: number }>,
  $mul?: StrictNumberUpdate<Schema> & Record<string, number>,
  $unset?: Record<string, ''>,
  $inc?: NumberUpdate<Schema> & Record<string, number>,
  $push?: Push<Schema> & SomeDoc,
  $pop?: Pop<Schema> & Record<string, number>,
  $rename?: Record<string, string>,
  $currentDate?: CurrentDate<Schema> & Record<string, boolean>,
  $addToSet?: Push<Schema> & SomeDoc,
}

/**
 * Represents the update filter to specify how to update a document.
 *
 * @example
 * ```typescript
 * const updateFilter: UpdateFilter<SomeDoc> = {
 *   $set: {
 *     'customer.name': 'Jim B.'
 *   },
 *   $unset: {
 *     'customer.phone': ''
 *   },
 *   $inc: {
 *     'customer.age': 1
 *   },
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
 */
export interface StrictUpdateFilter<Schema extends SomeDoc, InNotation = ToDotNotation<Schema>> {
  /**
   * Set the value of a field in the document.
   *
   * @example
   * ```typescript
   * const updateFilter: UpdateFilter<SomeDoc> = {
   *   $set: {
   *     'customer.name': 'Jim B.'
   *   }
   * }
   * ```
   */
  $set?: Partial<InNotation>,
  /**
   * Set the value of a field in the document if an upsert is performed.
   *
   * @example
   * ```typescript
   * const updateFilter: UpdateFilter<SomeDoc> = {
   *   $setOnInsert: {
   *     'customer.name': 'Jim B.'
   *   }
   * }
   * ```
   */
  $setOnInsert?: Partial<InNotation>,
  /**
   * Remove the field from the document.
   *
   * @example
   * ```typescript
   * const updateFilter: UpdateFilter<SomeDoc> = {
   *   $unset: {
   *     'customer.phone': ''
   *   }
   * }
   * ```
   */
  $unset?: Unset<InNotation>,
  /**
   * Increment the value of a field in the document if it's potentially a `number`.
   *
   * @example
   * ```typescript
   * const updateFilter: UpdateFilter<SomeDoc> = {
   *   $inc: {
   *     'customer.age': 1
   *   }
   * }
   * ```
   */
  $inc?: StrictNumberUpdate<InNotation>,
  /**
   * Add an element to an array field in the document.
   *
   * @example
   * ```typescript
   * const updateFilter: UpdateFilter<SomeDoc> = {
   *   $push: {
   *     'items': 'Extended warranty - 5 years'
   *   }
   * }
   * ```
   */
  $push?: StrictPush<InNotation>,
  /**
   * Remove an element from an array field in the document.
   *
   * @example
   * ```typescript
   * const updateFilter: UpdateFilter<SomeDoc> = {
   *   $pop: {
   *     'items': -1
   *   }
   * }
   * ```
   */
  $pop?: StrictPop<InNotation>,
  /**
   * Rename a field in the document.
   *
   * @example
   * ```typescript
   * const updateFilter: UpdateFilter<SomeDoc> = {
   *   $rename: {
   *     'customer.name': 'client.name'
   *   }
   * }
   * ```
   */
  $rename?: Rename<InNotation>,
  /**
   * Set the value of a field to the current date.
   *
   * @example
   * ```typescript
   * const updateFilter: UpdateFilter<SomeDoc> = {
   *   $currentDate: {
   *     'purchase_date': true
   *   }
   * }
   * ```
   */
  $currentDate?: CurrentDate<InNotation>,
  /**
   * Only update the field if the specified value is less than the existing value.
   *
   * @example
   * ```typescript
   * const updateFilter: UpdateFilter<SomeDoc> = {
   *   $min: {
   *     'customer.age': 18
   *   }
   * }
   * ```
   */
  $min?: StrictNumberUpdate<InNotation> | StrictDateUpdate<InNotation>,
  /**
   * Only update the field if the specified value is greater than the existing value.
   *
   * @example
   * ```typescript
   * const updateFilter: UpdateFilter<SomeDoc> = {
   *   $max: {
   *     'customer.age': 65
   *   }
   * }
   * ```
   */
  $max?: StrictNumberUpdate<InNotation> | StrictDateUpdate<InNotation>,
  /**
   * Multiply the value of a field in the document.
   *
   * @example
   * ```typescript
   * const updateFilter: UpdateFilter<SomeDoc> = {
   *   $mul: {
   *     'customer.age': 1.1
   *   }
   * }
   * ```
   */
  $mul?: StrictNumberUpdate<InNotation>,
  /**
   * Add an element to an array field in the document if it does not already exist.
   *
   * @example
   * ```typescript
   * const updateFilter: UpdateFilter<SomeDoc> = {
   *   $addToSet: {
   *     'items': 'Extended warranty - 5 years'
   *   }
   * }
   * ```
   */
  $addToSet?: StrictPush<InNotation>,
}

type Unset<Schema> = {
  [K in keyof Schema]?: ''
}

type Pop<Schema> ={
  [K in keyof ArrayUpdate<Schema>]?: number
}

type StrictPop<Schema> = ContainsArr<Schema> extends true ? {
  [K in keyof ArrayUpdate<Schema>]?: number
} : TypeErr<'Can not pop on a schema with no arrays'>

type Push<Schema> = {
  [K in keyof ArrayUpdate<Schema>]?: (
    | ArrayUpdate<Schema>[K]
    | { $each: ArrayUpdate<Schema>[K][], $position?: number }
  )
}

type StrictPush<Schema> = ContainsArr<Schema> extends true ? {
  [K in keyof ArrayUpdate<Schema>]?: (
    | ArrayUpdate<Schema>[K]
    | { $each: ArrayUpdate<Schema>[K][], $position?: number }
  )
} : TypeErr<'Can not perform array operation on a schema with no arrays'>

type Rename<Schema> = {
  [K in keyof Schema]?: string
}

type NumberUpdate<Schema> = {
  [K in keyof Schema as IsNum<Schema[K]> extends true ? K : never]?: number | bigint
}

type StrictNumberUpdate<Schema> = ContainsNum<Schema> extends true ? {
  [K in keyof Schema as IsNum<Schema[K]> extends true ? K : never]?: number | bigint
} : TypeErr<'Can not perform a number operation on a schema with no numbers'>;

type DateUpdate<Schema> = {
  [K in keyof Schema as ContainsDate<Schema[K]> extends true ? K : never]?: Date | { $date: number }
};

type StrictDateUpdate<Schema> = ContainsDate<Schema> extends true ? {
  [K in keyof Schema as ContainsDate<Schema[K]> extends true ? K : never]?: Date | { $date: number }
} : TypeErr<'Can not perform a date operation on a schema with no dates'>;

type ArrayUpdate<Schema> = {
  [K in keyof Schema as any[] extends Schema[K] ? K : never]?: PickArrayTypes<Schema[K]>
};

type CurrentDate<Schema> =  {
  [K in keyof Schema as Schema[K] extends Date | { $date: number } ? K : never]?: boolean
};

type ContainsArr<Schema> = any[] extends Schema[keyof Schema] ? true : false;
type ContainsNum<Schema> = IsNum<Schema[keyof Schema]>;
type ContainsDate<Schema> = IsDate<Schema[keyof Schema]>;

type PickArrayTypes<Schema> = Extract<Schema, any[]> extends (infer E)[] ? E : unknown
