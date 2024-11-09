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

// @example
//   ```ts
// // Get all documents
// const cursor = await collection.find({}, { limit: 10 });
//
// // Get documents by field equality
// const cursor = await collection.find({ name: 'John Doe' });
//
// // Get documents by field inequality
// const cursor = await collection.find({ name: { $ne: 'John Doe' } });
//
// // Get documents by field existence
// const cursor = await collection.find({ name: { $exists: true } });
//
// // Get documents by matching a field in a list
// const cursor = await collection.find({ name: { $in: ['John Doe', 'Jane Doe'] } });
//
// // Get documents by field numerical comparison
// const cursor = await collection.find({ age: { $gte: 21 } });
// const cursor = await collection.find({ age: { $lt: new Date() } });
//
// // Get documents by combining filters
// const cursor = await collection.find({ name: 'John Doe', age: { $gte: 21 } });
//
// // Get documents by complex filters combinators
// const cursor = await collection.find({
//   $not: {
//     $or: [
//       { name: 'John Doe' },
//       { age: { $gte: 21 } },
//     ],
//     friends: { $size: 5 },
//   },
// });
// ```

/**
 * Represents some filter operation for a given document schema.
 *
 * **If you want stricter type-checking and full auto-complete, see {@link StrictFilter}.**
 *
 * This is a more relaxed version of {@link StrictFilter} that doesn't type-check nested fields.
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
 * });
 * ```
 *
 * @see StrictFilter
 *
 * @public
 */
export type Filter<Schema extends SomeDoc> = {
  [K in keyof NoId<Schema>]?: FilterExpr<NoId<Schema>[K]>
} & {
  _id?: FilterExpr<IdOf<Schema>>,
  $and?: Filter<Schema>[],
  $or?: Filter<Schema>[],
  $not?: Filter<Schema>,
} & {
  [key: string]: any,
}

/**
 * Represents some filter operation for a given document schema.
 *
 * **If you want relaxed type-checking, see {@link Filter}.**
 *
 * This is a stricter version of {@link Filter} that type-checks nested fields.
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
 * @see Filter
 *
 * @public
 */
export type StrictFilter<Schema extends SomeDoc> = {
  [K in keyof ToDotNotation<NoId<Schema>>]?: FilterExpr<ToDotNotation<NoId<Schema>>[K]>
} & {
  _id?: FilterExpr<IdOf<Schema>>,
  $and?: StrictFilter<Schema>[],
  $or?: StrictFilter<Schema>[],
  $not?: StrictFilter<Schema>,
}

/**
 * Represents an expression in a filter statement, such as an exact value, or a filter operator
 *
 * @public
 */
export type FilterExpr<Elem> = Elem | FilterOps<Elem>;

/**
 * Represents filter operators such as `$eq` and `$in` (but not statements like `$and`)
 *
 * @public
 */
export type FilterOps<Elem> = {
  $eq?: Elem,
  $ne?: Elem,
  $in?: Elem[],
  $nin?: Elem[] /* I can't un-see this as 'Nine-Inch Nails'... */,
  $exists?: boolean,
} & (
  IsNum<Elem> extends false ? EmptyObj : NumFilterOps
) & (
  IsDate<Elem> extends false ? EmptyObj : (DateFilterOps | Date)
) & (
  any[] extends Elem ? ArrayFilterOps<Elem> : EmptyObj
)

/**
 * Represents filter operations exclusive to number (or dynamically typed) fields
 *
 * @public
 */
export interface NumFilterOps {
  /**
   * Less than (exclusive) some number
   */
  $lt?: number | bigint,
  /**
   * Less than or equal to some number
   */
  $lte?: number | bigint,
  /**
   * Greater than (exclusive) some number
   */
  $gt?: number | bigint,
  /**
   * Greater than or equal to some number
   */
  $gte?: number | bigint,
}

/**
 * Represents filter operations exclusive to Dates (or dynamically typed) fields
 *
 * @public
 */
export interface DateFilterOps {
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
export interface ArrayFilterOps<Elem> {
  /**
   * Checks if the array is of a certain size.
   */
  $size?: number,
  /**
   * Checks if the array contains all the specified elements.
   */
  $all?: Elem,
}
