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

import { ToDotNotation } from '@/src/client/types/dot-notation';
import { IsNum } from '@/src/client/types/utils';
import { SomeDoc } from '@/src/client/document';

/**
 * Represents some filter operation for a given document schema.
 * 
 * Disclaimer: It's strongly typed if a strict schema is passed in, but if
 * {@link SomeDoc} is used, operators (like `$and`) are no longer typechecked
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
 *     { $not: { arr: { $size: 0 } } }
 *   ]
 * });
 * ```
 */
export type Filter<Schema extends SomeDoc> = {
  [K in keyof ToDotNotation<Schema>]?: FilterExpr<ToDotNotation<Schema>[K]>
} & {
  _id?: FilterExpr<string>,
  $and?: Filter<Schema>[],
  $or?: Filter<Schema>[],
  $not?: Filter<Schema>,
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
  $nin?: Elem[] /* I can't unsee this as 'Nine-Inch Nails'... */,
  $exists?: boolean,
} & (
  // eslint-disable-next-line @typescript-eslint/ban-types -- Intersection w/ {} is a "noop" here
  IsNum<Elem> extends true ? NumFilterOps : {}
) & (
  // eslint-disable-next-line @typescript-eslint/ban-types -- Intersection w/ {} is a "noop" here
  any[] extends Elem ? ArrayFilterOps<Elem> : {}
)

/**
 * Represents filter operations exclusive to number (or dynamically typed) fields
 */
interface NumFilterOps {
  $lt?: number,
  $lte?: number,
  $gt?: number,
  $gte?: number,
}

/**
 * Represents filter operations exclusive to array (or dynamically typed) fields
 */
interface ArrayFilterOps<Elem> {
  $size?: number,
  $all?: Elem,
}
