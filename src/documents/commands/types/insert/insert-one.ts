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

import type { WithTimeout } from '@/src/lib/index.js';

/**
 * ##### Overview
 *
 * The options for a generic `updateOne` command performed on the Data API.
 *
 * @example
 * ```ts
 * const result = await collection.insertOne({
 *   name: 'John',
 *   age: 30,
 * }, {
 *   timeout: 10000,
 * });
 * ```
 *
 * @see CollectionInsertOneOptions
 * @see TableInsertOneOptions
 *
 * @public
 */
export type GenericInsertOneOptions = WithTimeout<'generalMethodTimeoutMs'>;

/**
 * Shouldn't be used by the user directly.
 *
 * @internal
 */
export interface GenericInsertOneResult<ID> {
  insertedId: ID,
}
