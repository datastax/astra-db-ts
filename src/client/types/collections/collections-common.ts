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

import { SomeDoc } from '@/src/client';
import { ToDotNotation } from '@/src/client/types/dot-notation';

/**
 * Represents the options for the vector search.
 *
 * @field dimension - The dimension of the vectors.
 * @field metric - The similarity metric to use for the vector search.
 * @field service - Options related to the vectorization pipeline, to specify an embedding service.
 */
export interface VectorOptions {
  /**
   * The dimension of the vectors stored in the collection.
   */
  dimension: number;
  /**
   * The similarity metric to use for the vector search.
   *
   * See [intro to vector databases](https://docs.datastax.com/en/astra/astra-db-vector/get-started/concepts.html#metrics) for more details.
   */
  metric: 'cosine' | 'euclidean' | 'dot_product';
}

/**
 * Represents the options for the indexing.
 *
 * **Only one of `allow` or `deny` can be specified.**
 *
 * See [indexing](https://docs.datastax.com/en/astra/astra-db-vector/api-reference/data-api-commands.html#advanced-feature-indexing-clause-on-createcollection) for more details.
 *
 * @field allow - The fields to index.
 * @field deny - The fields to not index.
 */
export type IndexingOptions<Schema extends SomeDoc> =
  | { allow: (keyof ToDotNotation<Schema>)[] | ['*'], deny?: never }
  | { deny: (keyof ToDotNotation<Schema>)[] | ['*'], allow?: never }
