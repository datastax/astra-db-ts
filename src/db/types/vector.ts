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

import type { LitUnion } from '@/src/lib/types.js';

/**
 * The options for defining the embedding service used for vectorize, to automatically transform your
 * text into a vector ready for semantic vector searching.
 *
 * You can find out more information about each provider/model in the [DataStax docs](https://docs.datastax.com/en/astra-db-serverless/databases/embedding-generation.html),
 * or through {@link DbAdmin.findEmbeddingProviders}.
 *
 * @field provider - The name of the embedding provider which provides the model to use
 * @field model - The specific model to use for embedding, or undefined if it's an endpoint-defined model
 * @field authentication - Object containing any necessary collections-bound authentication, if any
 * @field parameters - Object allowing arbitrary parameters that may be necessary on a per-model basis
 *
 * @public
 */
export interface VectorizeServiceOptions {
  /**
   * The name of the embedding provider which provides the model to use.
   *
   * You can find out more information about each provider in the [DataStax docs](https://docs.datastax.com/en/astra-db-serverless/databases/embedding-generation.html),
   * or through  {@link DbAdmin.findEmbeddingProviders}.
   */
  provider: string,
  /**
   * The name of the embedding model to use.
   *
   * You can find out more information about each model in the [DataStax docs](https://docs.datastax.com/en/astra-db-serverless/databases/embedding-generation.html),
   * or through {@link DbAdmin.findEmbeddingProviders}.
   */
  modelName: LitUnion<'endpoint-defined-model'>,
  /**
   * Object containing any necessary collections-bound authentication, if any.
   *
   * Most commonly, `providerKey: '*SHARED_SECRET_NAME*'` may be used here to reference an API key from the Astra KMS.
   *
   * {@link Db.createCollection} and {@link Db.collection} both offer an `embeddingApiKey` parameter which utilizes
   * header-based auth to pass the provider's token/api-key to the Data API on a per-request basis instead, if that
   * is preferred (or necessary).
   */
  authentication?: Record<string, string | undefined>,
  /**
   * Object allowing arbitrary parameters that may be necessary on a per-model/per-provider basis.
   *
   * Not all providers need this, but some, such as `huggingfaceDedicated` have required parameters, others have
   * optional parameters (e.g. `openAi`), and some don't require any at all.
   *
   * You can find out more information about each provider/model in the [DataStax docs](https://docs.datastax.com/en/astra-db-serverless/databases/embedding-generation.html),
   * or through {@link DbAdmin.findEmbeddingProviders}.
   */
  parameters?: Record<string, unknown>,
}
