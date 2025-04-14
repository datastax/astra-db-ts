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

import type { GenericUpdateOneOptions, GenericUpdateResult, IdOf } from '@/src/documents/index.js';

/**
 * ##### Overview
 *
 * The options for an `updateOne` command on a {@link Collection}.
 *
 * @example
 * ```ts
 * const result = await collection.updateOne(
 *   { name: 'John' },
 *   { $set: { dob: new Date('1990-01-01'), updatedAt: { $currentDate: true } } },
 *   { upsert: true, sort: { $vector: [...] } },
 * );
 * ```
 *
 * ---
 *
 * ##### Datatypes
 *
 * See {@link Collection}'s documentation for information on the available datatypes for collections.
 *
 * ---
 *
 * ##### Update operations
 *
 * See {@link CollectionUpdateFilter}'s documentation for information on the available update operations.
 *
 * @see Collection.updateOne
 * @see CollectionUpdateOneResult
 *
 * @public
 */
export type CollectionUpdateOneOptions = GenericUpdateOneOptions;

/**
 * ##### Overview
 *
 * Represents the result of an `updateOne` command on a {@link Collection}.
 *
 * > **🚨Important:** The exact result type depends on the `upsertedCount` field of the result:
 * - If `upsertedCount` is `0`, the result will be of type {@link GuaranteedUpdateResult} & {@link NoUpsertUpdateResult}.
 * - If `upsertedCount` is `1`, the result will be of type {@link GuaranteedUpdateResult} & {@link UpsertedUpdateResult}.
 *
 * @example
 * ```typescript
 * const result = await collection.updateOne(
 *   { _id: 'abc' },
 *   { $set: { name: 'John' } },
 *   { upsert: true },
 * );
 *
 * if (result.upsertedCount) {
 *   console.log(`Document with ID ${result.upsertedId} was upserted`);
 * }
 * ```
 *
 * @see Collection.updateOne
 * @see CollectionUpdateOneOptions
 *
 * @public
 */
export type CollectionUpdateOneResult<RSchema> = GenericUpdateResult<IdOf<RSchema>, 0 | 1>;
