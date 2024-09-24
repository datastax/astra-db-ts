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

import type { InternalUpdateResult } from '@/src/documents/collections/types';
import { WithTimeout } from '@/src/lib/types';
import { SomeDoc } from '@/src/documents/collections';

/** @internal */
export interface UpdateManyCommand {
  updateMany: {
    filter: Record<string, unknown>;
    update: Record<string, any>;
    options: UpdateManyOptions & {
      pageState?: string;
    };
  }
}

/**
 * Represents the options for the updateMany command.
 *
 * @field upsert - If true, perform an insert if no documents match the filter.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @public
 */
export interface UpdateManyOptions extends WithTimeout {
  /**
   * If true, perform an insert if no documents match the filter.
   *
   * If false, do not insert if no documents match the filter.
   *
   * Defaults to false.
   *
   * @defaultValue false
   */
  upsert?: boolean;
}

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
 * @field matchedCount - The number of documents that matched the filter.
 * @field modifiedCount - The number of documents that were actually modified.
 * @field upsertedCount - The number of documents that were upserted.
 * @field upsertedId - The identifier of the upserted document if `upsertedCount > 0`.
 *
 * @public
 */
export type UpdateManyResult<Schema extends SomeDoc> = InternalUpdateResult<Schema, number>;
