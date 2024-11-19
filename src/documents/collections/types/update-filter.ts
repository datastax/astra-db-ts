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

import { SomeDoc, ToDotNotation } from '@/src/documents';
import { TypeErr } from '@/src/documents/utils';
import { IsDate, IsNum } from '@/src/documents/types/utils';

/**
 * Represents the update filter to specify how to update a document.
 *
 * **If you want stricter type-checking and full auto-complete, see {@link StrictCollectionUpdateFilter}.**
 *
 * This is a more relaxed version of {@link StrictCollectionUpdateFilter} that doesn't type-check nested fields.
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
 * @see StrictCollectionUpdateFilter
 *
 * @public
 */
export interface CollectionUpdateFilter<Schema extends SomeDoc> {
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
  $inc?: CollectionNumberUpdate<Schema> & Record<string, number>,
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
  $push?: CollectionPush<Schema> & SomeDoc,
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
  $pop?: CollectionPop<Schema> & Record<string, number>,
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
  $currentDate?: CollectionCurrentDate<Schema> & Record<string, boolean>,
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
  $min?: (CollectionNumberUpdate<Schema> | CollectionDateUpdate<Schema>) & Record<string, number | bigint | Date | { $date: number }>,
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
  $max?: (CollectionNumberUpdate<Schema> | CollectionDateUpdate<Schema>) & Record<string, number | bigint | Date | { $date: number }>,
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
  $mul?: StrictCollectionNumberUpdate<Schema> & Record<string, number>,
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
  $addToSet?: CollectionPush<Schema> & SomeDoc,
}

/**
 * Represents the update filter to specify how to update a document.
 *
 * **If you want relaxed type-checking, see {@link CollectionUpdateFilter}.**
 *
 * This is a stricter version of {@link CollectionUpdateFilter} that type-checks nested fields.
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
 * @see CollectionUpdateFilter
 *
 * @public
 */
export interface StrictCollectionUpdateFilter<Schema extends SomeDoc> {
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
  $unset?: StrictCollectionUnset<Schema>,
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
  $inc?: StrictCollectionNumberUpdate<Schema>,
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
  $push?: StrictCollectionPush<Schema>,
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
  $pop?: StrictCollectionPop<Schema>,
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
  $rename?: StrictCollectionRename<Schema>,
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
  $currentDate?: CollectionCurrentDate<ToDotNotation<Schema>>,
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
  $min?: StrictCollectionNumberUpdate<Schema> | StrictCollectionDateUpdate<Schema>,
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
  $max?: StrictCollectionNumberUpdate<Schema> | StrictCollectionDateUpdate<Schema>,
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
  $mul?: StrictCollectionNumberUpdate<Schema>,
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
  $addToSet?: StrictCollectionPush<Schema>,
}

/**
 * Very strongly types the unset operation (inc. dot notation schema).
 *
 * @public
 */
export type StrictCollectionUnset<Schema extends SomeDoc> = {
  [K in keyof ToDotNotation<Schema>]?: '' | true | 1
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
 * Strongly types the pop operation (inc. dot notation schema).
 *
 * @public
 */
export type StrictCollectionPop<Schema extends SomeDoc, InNotation = ToDotNotation<Schema>> = ContainsArr<InNotation> extends true ? {
  [K in keyof CollectionArrayUpdate<InNotation>]?: number
} : TypeErr<'Can not pop on a schema with no arrays'>

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
 * Strongly types the push operation (inc. dot notation schema).
 *
 * @public
 */
export type StrictCollectionPush<Schema extends SomeDoc, InNotation = ToDotNotation<Schema>> = ContainsArr<InNotation> extends true ? {
  [K in keyof CollectionArrayUpdate<InNotation>]?: (
    | CollectionArrayUpdate<InNotation>[K]
    | { $each: CollectionArrayUpdate<InNotation>[K][], $position?: number }
  )
} : TypeErr<'Can not perform array operation on a schema with no arrays'>

/**
 * Strongly types the rename operation (inc. dot notation schema).
 *
 * @public
 */
export type StrictCollectionRename<Schema extends SomeDoc> = {
  [K in keyof ToDotNotation<Schema>]?: string
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
 * Strongly types number update operations (inc. dot notation schema).
 *
 * @public
 */
export type StrictCollectionNumberUpdate<Schema extends SomeDoc, InNotation = ToDotNotation<Schema>> = ContainsNum<InNotation> extends true ? {
  [K in keyof InNotation as IsNum<InNotation[K]> extends true ? K : never]?: number | bigint
} : TypeErr<'Can not perform a number operation on a schema with no numbers'>;

/**
 * Weaker version of StrictDateUpdate which allows for more flexibility in typing date update operations.
 *
 * @public
 */
export type CollectionDateUpdate<Schema> = {
  [K in keyof Schema as ContainsDate<Schema[K]> extends true ? K : never]?: Date | { $date: number }
};

/**
 * Strongly types date update operations (inc. dot notation schema).
 *
 * @public
 */
export type StrictCollectionDateUpdate<Schema extends SomeDoc, InNotation = ToDotNotation<Schema>> = ContainsDate<InNotation> extends true ? {
  [K in keyof InNotation as ContainsDate<InNotation[K]> extends true ? K : never]?: Date | { $date: number }
} : TypeErr<'Can not perform a date operation on a schema with no dates'>;

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

type ContainsArr<Schema> = any[] extends Schema[keyof Schema] ? true : false;
type ContainsNum<Schema> = IsNum<Schema[keyof Schema]>;
type ContainsDate<Schema> = IsDate<Schema[keyof Schema]>;
type PickArrayTypes<Schema> = Extract<Schema, any[]> extends (infer E)[] ? E : unknown
