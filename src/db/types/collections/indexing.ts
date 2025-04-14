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

import type { SomeDoc, ToDotNotation } from '@/src/documents/index.js';

/**
 * Represents the options for the indexing.
 *
 * **Only one of `allow` or `deny` can be specified.**
 *
 * See [indexing](https://docs.datastax.com/en/astra/astra-db-vector/api-reference/data-api-commands.html#advanced-feature-indexing-clause-on-createcollection) for more details.
 *
 * @example
 * ```typescript
 * const collection1 = await db.createCollection('my-collections', {
 *   indexing: {
 *     allow: ['name', 'age'],
 *   },
 * });
 *
 * const collection2 = await db.createCollection('my-collections', {
 *   indexing: {
 *     deny: ['*'],
 *   },
 * });
 * ```
 *
 * @field allow - The fields to index.
 * @field deny - The fields to not index.
 *
 * @public
 */
export type CollectionIndexingOptions<Schema extends SomeDoc> =
  | { allow: (keyof ToDotNotation<Schema> | string)[] | ['*'], deny?: never }
  | { deny: (keyof ToDotNotation<Schema> | string)[] | ['*'], allow?: never }
