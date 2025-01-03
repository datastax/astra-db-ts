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

import type { SomeRow } from '@/src/documents';

/**
 * Represents some filter operation for a given document schema.
 *
 * @example
 * ```typescript
 * interface BasicSchema {
 *   arr: string[],
 *   num: number,
 * }
 *
 * db.Tables<BasicSchema>('coll_name').findOne({
 *   $and: [
 *     { _id: { $in: ['abc', 'def'] } },
 *     { $not: { arr: { $size: 0 } } },
 *   ]
 * });
 * ```
 *
 * @public
 */
export type TableFilter<Schema extends SomeRow> = {
  [K in keyof Schema]?: TableFilterExpr<Schema[K]>
} & {
  $and?: TableFilter<Schema>[],
  $or?: TableFilter<Schema>[],
  $not?: TableFilter<Schema>,
  [key: string]: any,
}

/**
 * Represents an expression in a filter statement, such as an exact value, or a filter operator
 *
 * @public
 */
export type TableFilterExpr<Elem> = Elem | TableFilterOps<Elem>;

/**
 * Represents filter operators such as `$eq` and `$in` (but not statements like `$and`)
 *
 * @public
 */
export type TableFilterOps<Elem> = {
  $eq?: Elem,
  $ne?: Elem,
  $in?: Elem[],
  $nin?: Elem[] /* I can't un-see this as 'Nine-Inch Nails'... */,
  $exists?: boolean,
  $lt?: Elem,
  $lte?: Elem,
  $gt?: Elem,
  $gte?: Elem,
}
