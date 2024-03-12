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

import { SomeId } from '@/src/client/types/common';
import { Schema } from '@/tests/typing/prelude';
import { SomeDoc } from '@/src/client';

/**
 * Checks if a type can possibly be some number
 * 
 * @example
 * ```
 * IsNum<string | number> === true
 * ```
 */
export type IsNum<T> = number extends T ? true : bigint extends T ? true : false

/**
 * Checks if a type can possibly be a date
 *
 * @example
 * ```
 * IsDate<string | Date> === boolean
 * ```
 */
export type IsDate<T> = T extends Date ? true : false

/**
 * Forces the given type to include an `_id`
 */
export type WithId<T> = Omit<T, '_id'> & { _id: IdOf<Schema> }

/**
 * Includes a `$similarity` field if the typeparam `GetSim` is `true`
 */
type WithSim<T, GetSim extends boolean> = GetSim extends true
  ? Omit<T, '$similarity'> & { $similarity: number  }
  : Omit<T, '$similarity'> & { $similarity: undefined }

/**
 * Shorthand type for `WithSim` & `WithId`
 */
export type FoundDoc<Doc, GetSim extends boolean> = WithSim<WithId<Doc>, GetSim>

/**
 * Represents a doc that doesn't have an `_id`
 */
export type NoId<Doc> = Omit<Doc, '_id'>

/**
 * Represents a flattened version of the given type. Only goes one level deep.
 */
export type Flatten<Type> = Type extends (infer Item)[]
  ? Item
  : Type

export type IdOf<TSchema> =
  TSchema extends { _id: infer Id; }
    ? Id extends SomeId
      ? Id
      : never :
  TSchema extends { _id?: infer Id; }
    ? unknown extends Id
      ? SomeId
      : Id
    : SomeId
