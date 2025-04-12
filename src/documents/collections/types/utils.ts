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

import type { ObjectId, UUID } from '@/src/documents/index.js';

/**
 * All possible types for a document ID. JSON scalar types, `Date`, `UUID`, and `ObjectId`.
 *
 * Note that the `_id` *can* technically be `null`. Trying to set the `_id` to `null` doesn't mean "auto-generate
 * an ID" like it may in some other databases; it quite literally means "set the ID to `null`".
 *
 * It's heavily recommended to properly type this in your Schema, so you know what to expect for your `_id` field.
 *
 * @public
 */
export type SomeId = string | number | bigint | boolean | Date | UUID | ObjectId | null;

/**
 * Allows the given type to include an `_id` or not, even if it's not declared in the type
 *
 * @public
 */
export type MaybeId<T> = NoId<T> & { _id?: IdOf<T> }

/**
 * Includes an `_id` in the given type, even if it's not declared in the type
 *
 * @public
 */
export type WithId<T> = T & { _id: IdOf<T> }

/**
 * Represents a document as it's returned by the database by default.
 *
 * @public
 */
export type FoundDoc<Doc> = { _id: IdOf<Doc> } & NoId<Omit<Doc, '$vector' | '$vectorize'>>;

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
export type IdOf<Doc> =
  Doc extends { _id?: infer Id extends SomeId }
    ? Id
    : SomeId
