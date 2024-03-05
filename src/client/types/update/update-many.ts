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

import { InternalUpdateResult } from '@/src/client/types/update/update-common';

// Internal
export interface UpdateManyCommand {
  updateMany: {
    filter: Record<string, unknown>;
    update: Record<string, any>;
    options?: UpdateManyOptions;
  }
}

/**
 * Represents the options for the updateMany command.
 *
 * @field upsert - If true, perform an insert if no documents match the filter.
 */
export interface UpdateManyOptions {
  /**
   * If true, perform an insert if no documents match the filter.
   *
   * If false, do not insert if no documents match the filter.
   *
   * Defaults to false.
   * @default false
   */
  upsert?: boolean;
}

// Internal
export const updateManyOptionKeys = new Set(['upsert']);

/**
 * Represents the result of an updateMany operation.
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
 * @field acknowledged - True if the operation was acknowledged.
 * @field matchedCount - The number of documents that matched the filter.
 * @field modifiedCount - The number of documents that were actually modified.
 * @field upsertedCount - The number of documents that were upserted.
 * @field upsertedId - The identifier of the upserted document if `upsertedCount > 0`.
 */
export type UpdateManyResult = InternalUpdateResult<number>;
