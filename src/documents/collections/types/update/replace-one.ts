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

import type { GenericReplaceOneOptions, GenericUpdateResult, IdOf } from '@/src/documents';

/**
 * Represents the options for the `replaceOne` command.
 *
 * @field upsert - If true, perform an insert if no documents match the filter.
 * @field sort - The sort order to pick which document to replace if the filter selects multiple documents.
 * @field timeout - The timeout override for this method
 *
 * @see Collection.replaceOne
 *
 * @public
 */
export type CollectionReplaceOneOptions = GenericReplaceOneOptions;

/**
 * Represents the result of a replaceOne operation.
 *
 * @example
 * ```typescript
 * const result = await collection.replaceOne({
 *   _id: 'abc'
 * }, {
 *   name: 'John'
 * }, {
 *   upsert: true
 * });
 *
 * if (result.upsertedCount) {
 *   console.log(`Document with ID ${result.upsertedId} was upserted`);
 * }
 * ```
 *
 * @field matchedCount - The number of documents that matched the filter.
 * @field modifiedCount - The number of documents that were actually modified.
 * @field upsertedCount - The number of documents that were upserted.
 * @field upsertedId - The identifier of the upserted document if `upsertedCount > 0`.
 *
 * @see Collection.replaceOne
 *
 * @public
 */
export type CollectionReplaceOneResult<RSchema> = GenericUpdateResult<IdOf<RSchema>, 0 | 1>;
