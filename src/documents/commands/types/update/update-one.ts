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

import type { CommandOptions } from '@/src/lib/index.js';
import type { Sort } from '@/src/documents/index.js';

/**
 * ##### Overview
 *
 * The options for a generic `updateOne` command performed on the Data API.
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
 * @see CollectionUpdateOneOptions
 * @see TableUpdateOneOptions
 *
 * @public
 */
export interface GenericUpdateOneOptions extends CommandOptions<{ timeout: 'generalMethodTimeoutMs' }> {
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
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - Use `sort: { $vector: [...] }` instead.
   */
  vector?: 'ERROR: Use `sort: { $vector: [...] }` instead',
  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - Use `sort: { $vectorize: '...' }` instead.
   */
  vectorize?: 'ERROR: Use `sort: { $vectorize: "..." }` instead',
}
