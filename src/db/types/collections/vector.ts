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

import type { VectorizeServiceOptions } from '@/src/db/index.js';
import type { LitUnion } from '@/src/lib/types.js';

/**
 * Represents the options for the vector search.
 *
 * @field dimension - The dimension of the vectors.
 * @field metric - The similarity metric to use for the vector search.
 * @field service - Options related to configuring the automatic embedding service (vectorize)
 *
 * @public
 */
export interface CollectionVectorOptions {
  /**
   * The dimension of the vectors stored in the collections.
   *
   * If `service` is not provided, this must be set. Otherwise, the necessity of this being set comes on a per-model
   * basis:
   * - Some models have default vector dimensions which may be flexibly modified
   * - Some models have no default dimension, and must be given an explicit one
   * - Some models require a specific dimension that's already set by default
   *
   * You can find out more information about each model in the [DataStax docs](https://docs.datastax.com/en/astra-db-serverless/databases/embedding-generation.html),
   * or through {@link DbAdmin.findEmbeddingProviders}.
   */
  dimension?: number,
  /**
   * The similarity metric to use for the vector search.
   *
   * See [intro to vector databases](https://docs.datastax.com/en/astra/astra-db-vector/get-started/concepts.html#metrics) for more details.
   */
  metric?: 'cosine' | 'euclidean' | 'dot_product',
  /**
   * The options for defining the embedding service used for vectorize, to automatically transform your
   * text into a vector ready for semantic vector searching.
   *
   * You can find out more information about each provider/model in the [DataStax docs](https://docs.datastax.com/en/astra-db-serverless/databases/embedding-generation.html),
   * or through {@link DbAdmin.findEmbeddingProviders}.
   */
  service?: VectorizeServiceOptions,
  /**
   * Configures the index with the fastest settings for a given source of embeddings vectors.
   *
   * As of time of writing, example `sourceModel`s include `'openai-v3-large'`, `'cohere-v3'`, `'bert'`, and a handful of others.
   *
   * If no source model if provided, this setting will default to `'other'`.
   */
  sourceModel?: LitUnion<'other'>,
}
