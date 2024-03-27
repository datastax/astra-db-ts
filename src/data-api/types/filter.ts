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

import type { SomeDoc } from '@/src/data-api';
import type { IdOf, IsDate, IsNum, NoId, ToDotNotation } from '@/src/data-api/types';

/**
 * Represents some filter operation for a given document schema.
 *
 * **If you want stricter type-checking, see {@link StrictFilter}.**
 *
 * This is a more relaxed version of {@link StrictFilter} that doesn't type-check nested fields.
 *
 * @example
 * ```
 * interface BasicSchema {
 *   arr: string[],
 *   num: number,
 * }
 *
 * db.collection<BasicSchema>('coll_name').findOne({
 *   $and: [
 *     { _id: { $in: ['abc', 'def'] } },
 *     { $not: { arr: { $size: 0 } } },
 *   ]
 * });
 * ```
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
 * ```
 * interface BasicSchema {
 *   arr: string[],
 *   num: number,
 * }
 *
 * db.collection<BasicSchema>('coll_name').findOne({
 *   $and: [
 *     { _id: { $in: ['abc', 'def'] } },
 *     { $not: { arr: { $size: 0 } } },
 *   ]
 * } satisfies StrictFilter<BasicSchema>);
 * ```
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
 */
type FilterExpr<Elem> = Elem | FilterOps<Elem>;

/**
 * Represents filter operators such as `$eq` and `$in` (but not statements like `$and`)
 */
type FilterOps<Elem> = {
  $eq?: Elem,
  $ne?: Elem,
  $in?: Elem[],
  $nin?: Elem[] /* I can't un-see this as 'Nine-Inch Nails'... */,
  $exists?: boolean,
} & (
  // eslint-disable-next-line @typescript-eslint/ban-types -- Intersection w/ {} is a "noop" here
  IsNum<Elem> extends false ? {} : NumFilterOps
) & (
  // eslint-disable-next-line @typescript-eslint/ban-types -- Intersection w/ {} is a "noop" here
  IsDate<Elem> extends false ? {} : DateFilterOps
) & (
  // eslint-disable-next-line @typescript-eslint/ban-types -- Intersection w/ {} is a "noop" here
  any[] extends Elem ? ArrayFilterOps<Elem> : {}
)

/**
 * Represents filter operations exclusive to number (or dynamically typed) fields
 */
interface NumFilterOps {
  $lt?: number | bigint,
  $lte?: number | bigint,
  $gt?: number | bigint,
  $gte?: number | bigint,
}

/**
 * Represents filter operations exclusive to Dates (or dynamically typed) fields
 */
interface DateFilterOps {
  $lt?: Date | { $date: number },
  $lte?: Date | { $date: number },
  $gt?: Date | { $date: number },
  $gte?: Date | { $date: number },
  $date?: number,
}

/**
 * Represents filter operations exclusive to array (or dynamically typed) fields
 */
interface ArrayFilterOps<Elem> {
  $size?: number,
  $all?: Elem,
}
