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

import type { SomeDoc, TypeErr } from '@/src/data-api';
import type { ToDotNotation } from '@/src/data-api/types';
import { IsDate, IsNum } from '@/src/data-api/types/utils';

/**
 * Represents the update filter to specify how to update a document.
 *
 * **If you want stricter type-checking and full auto-complete, see {@link StrictUpdateFilter}.**
 *
 * This is a more relaxed version of {@link StrictUpdateFilter} that doesn't type-check nested fields.
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
 *
 * @public
 */
export interface UpdateFilter<Schema extends SomeDoc> {
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
  $set?: Partial<Schema> & SomeDoc,
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
  $setOnInsert?: Partial<Schema> & SomeDoc,
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
  $unset?: Record<string, '' | true | 1>,
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
  $inc?: NumberUpdate<Schema> & Record<string, number>,
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
  $push?: Push<Schema> & SomeDoc,
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
  $pop?: Pop<Schema> & Record<string, number>,
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
  $rename?: Record<string, string>,
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
  $currentDate?: CurrentDate<Schema> & Record<string, boolean>,
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
  $min?: (NumberUpdate<Schema> | DateUpdate<Schema>) & Record<string, number | bigint | Date | { $date: number }>,
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
  $max?: (NumberUpdate<Schema> | DateUpdate<Schema>) & Record<string, number | bigint | Date | { $date: number }>,
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
  $mul?: StrictNumberUpdate<Schema> & Record<string, number>,
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
  $addToSet?: Push<Schema> & SomeDoc,
}

/**
 * Represents the update filter to specify how to update a document.
 *
 * **If you want relaxed type-checking, see {@link UpdateFilter}.**
 *
 * This is a stricter version of {@link UpdateFilter} that type-checks nested fields.
 *
 * You can use it anywhere by using the `satisfies` keyword, or by creating a temporary const with the StrictUpdateFilter type.
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
 * } satisfies StrictUpdateFilter<SomeDoc>
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
export interface StrictUpdateFilter<Schema extends SomeDoc> {
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
  $set?: Partial<ToDotNotation<Schema>>,
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
  $setOnInsert?: Partial<ToDotNotation<Schema>>,
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
  $unset?: StrictUnset<Schema>,
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
  $inc?: StrictNumberUpdate<Schema>,
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
  $push?: StrictPush<Schema>,
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
  $pop?: StrictPop<Schema>,
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
  $rename?: StrictRename<Schema>,
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
  $currentDate?: CurrentDate<ToDotNotation<Schema>>,
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
  $min?: StrictNumberUpdate<Schema> | StrictDateUpdate<Schema>,
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
  $max?: StrictNumberUpdate<Schema> | StrictDateUpdate<Schema>,
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
  $mul?: StrictNumberUpdate<Schema>,
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
  $addToSet?: StrictPush<Schema>,
}

/**
 * Very strongly types the unset operation (inc. dot notation schema).
 *
 * @public
 */
export type StrictUnset<Schema extends SomeDoc> = {
  [K in keyof ToDotNotation<Schema>]?: '' | true | 1
}

/**
 * Weaker version os StrictPop which allows for more flexibility in typing pop operations.
 *
 * @public
 */
export type Pop<Schema> ={
  [K in keyof ArrayUpdate<Schema>]?: number
}

/**
 * Strongly types the pop operation (inc. dot notation schema).
 *
 * @public
 */
export type StrictPop<Schema extends SomeDoc, InNotation = ToDotNotation<Schema>> = ContainsArr<InNotation> extends true ? {
  [K in keyof ArrayUpdate<InNotation>]?: number
} : TypeErr<'Can not pop on a schema with no arrays'>

/**
 * Weaker version of StrictPush which allows for more flexibility in typing push operations.
 *
 * @public
 */
export type Push<Schema> = {
  [K in keyof ArrayUpdate<Schema>]?: (
    | ArrayUpdate<Schema>[K]
    | { $each: ArrayUpdate<Schema>[K][], $position?: number }
  )
}

/**
 * Strongly types the push operation (inc. dot notation schema).
 *
 * @public
 */
export type StrictPush<Schema extends SomeDoc, InNotation = ToDotNotation<Schema>> = ContainsArr<InNotation> extends true ? {
  [K in keyof ArrayUpdate<InNotation>]?: (
    | ArrayUpdate<InNotation>[K]
    | { $each: ArrayUpdate<InNotation>[K][], $position?: number }
  )
} : TypeErr<'Can not perform array operation on a schema with no arrays'>

/**
 * Strongly types the rename operation (inc. dot notation schema).
 *
 * @public
 */
export type StrictRename<Schema extends SomeDoc> = {
  [K in keyof ToDotNotation<Schema>]?: string
}

/**
 * Weaker version of StrictNumberUpdate which allows for more flexibility in typing number update operations.
 *
 * @public
 */
export type NumberUpdate<Schema> = {
  [K in keyof Schema as IsNum<Schema[K]> extends true ? K : never]?: number | bigint
}

/**
 * Strongly types number update operations (inc. dot notation schema).
 *
 * @public
 */
export type StrictNumberUpdate<Schema extends SomeDoc, InNotation = ToDotNotation<Schema>> = ContainsNum<InNotation> extends true ? {
  [K in keyof InNotation as IsNum<InNotation[K]> extends true ? K : never]?: number | bigint
} : TypeErr<'Can not perform a number operation on a schema with no numbers'>;

/**
 * Weaker version of StrictDateUpdate which allows for more flexibility in typing date update operations.
 *
 * @public
 */
export type DateUpdate<Schema> = {
  [K in keyof Schema as ContainsDate<Schema[K]> extends true ? K : never]?: Date | { $date: number }
};

/**
 * Strongly types date update operations (inc. dot notation schema).
 *
 * @public
 */
export type StrictDateUpdate<Schema extends SomeDoc, InNotation = ToDotNotation<Schema>> = ContainsDate<InNotation> extends true ? {
  [K in keyof InNotation as ContainsDate<InNotation[K]> extends true ? K : never]?: Date | { $date: number }
} : TypeErr<'Can not perform a date operation on a schema with no dates'>;

/**
 * Types some array operations. Not inherently strict or weak.
 *
 * @public
 */
export type ArrayUpdate<Schema> = {
  [K in keyof Schema as any[] extends Schema[K] ? K : never]?: PickArrayTypes<Schema[K]>
};

/**
 * Types the $currentDate operation. Not inherently strict or weak.
 *
 * @public
 */
export type CurrentDate<Schema> =  {
  [K in keyof Schema as Schema[K] extends Date | { $date: number } ? K : never]?: boolean
};

type ContainsArr<Schema> = any[] extends Schema[keyof Schema] ? true : false;
type ContainsNum<Schema> = IsNum<Schema[keyof Schema]>;
type ContainsDate<Schema> = IsDate<Schema[keyof Schema]>;
type PickArrayTypes<Schema> = Extract<Schema, any[]> extends (infer E)[] ? E : unknown
