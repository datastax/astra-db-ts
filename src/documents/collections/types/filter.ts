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
import type { EmptyObj } from '@/src/lib/types';

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
 * @public
 */
export type CollectionFilter<Schema extends SomeDoc> = {
  [K in keyof ToDotNotation<NoId<Schema>>]?: CollectionFilterExpr<ToDotNotation<NoId<Schema>>[K]>
} & {
  _id?: CollectionFilterExpr<IdOf<Schema>>,
  $and?: CollectionFilter<Schema>[],
  $or?: CollectionFilter<Schema>[],
  $not?: CollectionFilter<Schema>,
  [key: string]: any,
}

/**
 * Represents an expression in a filter statement, such as an exact value, or a filter operator
 *
 * @public
 */
export type CollectionFilterExpr<Elem> = Elem | (CollectionFilterOps<Elem> & Record<string, any>);

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
  $lt?: Elem,
  $lte?: Elem,
  $gt?: Elem,
  $gte?: Elem,
} & (
  any[] extends Elem ? CollectionArrayFilterOps<Elem> : EmptyObj
)

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
