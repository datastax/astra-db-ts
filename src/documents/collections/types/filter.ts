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

import type { SomeDoc } from '@/src/documents/collections';
import type { IdOf, NoId, ToDotNotation } from '@/src/documents';
import { EmptyObj } from '@/src/lib/types';
import { IsDate, IsNum } from '@/src/documents/types/utils';
import BigNumber from 'bignumber.js';

/**
 * Represents some filter operation for a given document schema.
 *
 * **If you want stricter type-checking and full auto-complete, see {@link StrictCollectionFilter}.**
 *
 * This is a more relaxed version of {@link StrictCollectionFilter} that doesn't type-check nested fields.
 *
 * @example
 * ```typescript
 * interface BasicSchema {
 *   arr: string[],
 *   num: number,
 * }
 *
 * db.collections<BasicSchema>('coll_name').findOne({
 *   $and: [
 *     { _id: { $in: ['abc', 'def'] } },
 *     { $not: { arr: { $size: 0 } } },
 *   ],
 * });
 * ```
 *
 * @see StrictCollectionFilter
 *
 * @public
 */
export type CollectionFilter<Schema extends SomeDoc> = {
  [K in keyof ToDotNotation<NoId<Schema>>]?: CollectionFilterExpr<ToDotNotation<NoId<Schema>>[K]>
} & {
  _id?: CollectionFilterExpr<IdOf<Schema>>,
  $and?: CollectionFilter<Schema>[],
  $or?: CollectionFilter<Schema>[],
  $not?: CollectionFilter<Schema>,
} & {
  [key: string]: any,
}

/**
 * Represents some filter operation for a given document schema.
 *
 * **If you want relaxed type-checking, see {@link CollectionFilter}.**
 *
 * This is a stricter version of {@link CollectionFilter} that type-checks nested fields.
 *
 * You can use it anywhere by using the `satisfies` keyword, or by creating a temporary const with the StrictFilter type.
 *
 * @example
 * ```typescript
 * interface BasicSchema {
 *   arr: string[],
 *   num: number,
 * }
 *
 * db.collections<BasicSchema>('coll_name').findOne({
 *   $and: [
 *     { _id: { $in: ['abc', 'def'] } },
 *     { $not: { arr: { $size: 0 } } },
 *   ]
 * } satisfies StrictFilter<BasicSchema>);
 * ```
 *
 * @see CollectionFilter
 *
 * @public
 */
export type StrictCollectionFilter<Schema extends SomeDoc> = {
  [K in keyof ToDotNotation<NoId<Schema>>]?: StrictCollectionFilterExpr<ToDotNotation<NoId<Schema>>[K]>
} & {
  _id?: StrictCollectionFilterExpr<IdOf<Schema>>,
  $and?: StrictCollectionFilter<Schema>[],
  $or?: StrictCollectionFilter<Schema>[],
  $not?: StrictCollectionFilter<Schema>,
}

/**
 * Represents an expression in a filter statement, such as an exact value, or a filter operator
 *
 * @public
 */
export type CollectionFilterExpr<Elem> = Elem | (CollectionFilterOps<Elem> & { [key: string]: any });

/**
 * Represents an expression in a filter statement, such as an exact value, or a filter operator
 *
 * @public
 */
export type StrictCollectionFilterExpr<Elem> = Elem | CollectionFilterOps<Elem>;

/**
 * Represents filter operators such as `$eq` and `$in` (but not statements like `$and`)
 *
 * @public
 */
export type CollectionFilterOps<Elem> = {
  $eq?: Elem,
  $ne?: Elem,
  $in?: Elem[],
  $nin?: Elem[] /* I can't un-see this as 'Nine-Inch Nails'... */,
  $exists?: boolean,
} & (
  IsNum<Elem> extends false ? EmptyObj : CollectionNumFilterOps
) & (
  IsDate<Elem> extends false ? EmptyObj : (CollectionDateFilterOps | Date)
) & (
  any[] extends Elem ? CollectionArrayFilterOps<Elem> : EmptyObj
)

/**
 * Represents filter operations exclusive to number (or dynamically typed) fields
 *
 * @public
 */
export interface CollectionNumFilterOps {
  /**
   * Less than (exclusive) some number
   */
  $lt?: number | bigint | BigNumber,
  /**
   * Less than or equal to some number
   */
  $lte?: number | bigint | BigNumber,
  /**
   * Greater than (exclusive) some number
   */
  $gt?: number | bigint | BigNumber,
  /**
   * Greater than or equal to some number
   */
  $gte?: number | bigint | BigNumber,
}

/**
 * Represents filter operations exclusive to Dates (or dynamically typed) fields
 *
 * @public
 */
export interface CollectionDateFilterOps {
  /**
   * Less than (exclusive) some date.
   *
   * `{ $date: number }` can be replaced with `new Date(number)`.
   */
  $lt?: Date,
  /**
   * Less than or equal to some date.
   *
   * `{ $date: number }` can be replaced with `new Date(number)`.
   */
  $lte?: Date,
  /**
   * Greater than (exclusive) some date.
   *
   * `{ $date: number }` can be replaced with `new Date(number)`.
   */
  $gt?: Date,
  /**
   * Greater than or equal to some date.
   *
   * `{ $date: number }` can be replaced with `new Date(number)`.
   */
  $gte?: Date,
}

/**
 * Represents filter operations exclusive to array (or dynamically typed) fields
 *
 * @public
 */
export interface CollectionArrayFilterOps<Elem> {
  /**
   * Checks if the array is of a certain size.
   */
  $size?: number,
  /**
   * Checks if the array contains all the specified elements.
   */
  $all?: Elem,
}
