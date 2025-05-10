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

import type { GenericFindOptions } from '@/src/documents/index.js';

/**
 * ##### Overview
 *
 * The options for a `find` command on a {@link Collection}.
 *
 * @example
 * ```ts
 * const results = await collection.find({
 *   category: 'electronics',
 * }, {
 *   sort: { price: 1 },
 *   limit: 10,
 *   timeout: 10000,
 * });
 * ```
 *
 * ---
 *
 * ##### Builder Methods
 *
 * You can also use fluent builder methods on the cursor:
 *
 * @example
 * ```ts
 * const cursor = collection.find({ category: 'electronics' })
 *   .sort({ price: 1 })
 *   .limit(10)
 *   .skip(5);
 *
 * const results = await cursor.toArray();
 * ```
 *
 * @see Collection.find
 * @see CollectionFindCursor
 *
 * @public
 */
export type CollectionFindOptions = GenericFindOptions;
