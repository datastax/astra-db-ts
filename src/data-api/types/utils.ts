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

import type { SomeId } from '@/src/data-api/types';

/**
 * Checks if a type can possibly be some number
 *
 * @example
 * ```
 * IsNum<string | number> === true
 * ```
 *
 * @internal
 */
export type IsNum<T> = number extends T ? true : bigint extends T ? true : false

/**
 * Checks if a type can possibly be a date
 *
 * @example
 * ```
 * IsDate<string | Date> === boolean
 * ```
 *
 * @internal
 */
export type IsDate<T> = IsAny<T> extends true ? true : T extends Date | { $date: number } ? true : false

/**
 * Checks if a type is any
 *
 * @internal
 */
export type IsAny<T> = true extends false & T ? true : false

/**
 * Forces the given type to include an `_id`
 *
 * @public
 */
export type WithId<T> = NoId<T> & { _id: IdOf<T> }

/**
 * Allows the given type to include an `_id` or not, even if it's not declared in the type
 *
 * @public
 */
export type MaybeId<T> = NoId<T> & { _id?: IdOf<T> }

/**
 * Includes a `$similarity` field if the type-param `GetSim` is `true`
 *
 * @public
 */
export type WithSim<T, GetSim extends boolean> = GetSim extends true
  ? Omit<T, '$similarity'> & { $similarity: number }
  : Omit<T, '$similarity'> & { $similarity?: never }

/**
 * Shorthand type for `WithSim` & `WithId`
 *
 * @public
 */
export type FoundDoc<Doc, GetSim extends boolean> = WithSim<WithId<Doc>, GetSim>

/**
 * Represents a doc that doesn't have an `_id`
 *
 * @public
 */
export type NoId<Doc> = Omit<Doc, '_id'>

/**
 * Represents a flattened version of the given type. Only goes one level deep.
 *
 * @public
 */
export type Flatten<Type> = Type extends (infer Item)[]
  ? Item
  : Type

/**
 * Extracts the `_id` type from a given schema, or defaults to `SomeId` if uninferable
 *
 * @public
 */
export type IdOf<TSchema> =
  TSchema extends { _id: infer Id }
    ? Id :
  TSchema extends { _id?: infer Id }
    ? unknown extends Id
      ? SomeId
      : Id
    : SomeId

/**
 * Makes all fields in a type mutable
 *
 * @internal
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};
