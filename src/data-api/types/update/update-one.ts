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
import type { InternalUpdateResult, Sort } from '@/src/data-api/types';
import { WithTimeout } from '@/src/common/types';

/** @internal */
export interface UpdateOneCommand {
  updateOne: {
    filter: Record<string, unknown>;
    update: Record<string, any>;
    sort?: Sort;
    options: {
      upsert?: boolean;
    };
  }
}

/**
 * Represents the options for the updateOne command.
 *
 * @field upsert - If true, perform an insert if no documents match the filter.
 * @field sort - The sort order to pick which document to update if the filter selects multiple documents.
 * @field vector - An optional vector to use for the appropriate dimensionality to perform an ANN vector search on the collection.
 *
 * @see Collection.updateOne
 *
 * @public
 */
export interface UpdateOneOptions extends WithTimeout {
  /**
   * If true, perform an insert if no documents match the filter.
   *
   * If false, do not insert if no documents match the filter.
   *
   * Defaults to false.
   *
   * @defaultValue false
   */
  upsert?: boolean,
  /**
   * The order in which to apply the update if the filter selects multiple documents.
   *
   * If multiple documents match the filter, only one will be updated.
   *
   * Defaults to `null`, where the order is not guaranteed.
   *
   * @defaultValue null
   */
  sort?: Sort,
  /**
   * An optional vector to use of the appropriate dimensionality to perform an ANN vector search on the collection
   * to find the closest matching document.
   *
   * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field in the
   * sort field itself. The two are interchangeable, but mutually exclusive.
   *
   * If the sort field is already set, an error will be thrown. If you really need to use both, you can set the $vector
   * field in the sort object directly.
   *
   * @deprecated - Prefer to use `sort: { $vector: [...] }` instead
   */
  vector?: number[],
  /**
   * NOTE: This feature is under current development.
   *
   * @deprecated - Prefer to use `sort: { $vectorize: '...' }` instead
   */
  vectorize?: string,
}

/**
 * Represents the result of an updateOne operation.
 *
 * @example
 * ```typescript
 * const result = await collection.updateOne({
 *   _id: 'abc'
 * }, {
 *   $set: { name: 'John' }
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
 * @see Collection.updateOne
 *
 * @public
 */
export type UpdateOneResult<Schema extends SomeDoc> = InternalUpdateResult<Schema, 0 | 1>;
