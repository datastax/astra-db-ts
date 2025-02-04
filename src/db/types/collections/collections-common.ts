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

import type { SomeDoc } from '@/src/documents/collections/index.js';
import type { ToDotNotation } from '@/src/documents/types/dot-notation.js';
import type { nullish } from '@/src/lib/index.js';

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
  sourceModel?: string,
}

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
  modelName: string | nullish,
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
 *   indexing: {
 *     allow: ['name', 'age'],
 *   },
 * });
 *
 * const collection2 = await db.createCollection('my-collections', {
 *   indexing: {
 *     deny: ['*'],
 *   },
 * });
 * ```
 *
 * @field allow - The fields to index.
 * @field deny - The fields to not index.
 *
 * @public
 */
export type CollectionIndexingOptions<Schema extends SomeDoc> =
  | { allow: (keyof ToDotNotation<Schema> | string)[] | ['*'], deny?:  never }
  | { deny:  (keyof ToDotNotation<Schema> | string)[] | ['*'], allow?: never }

/**
 * Represents the options for the default ID.
 *
 * **If `type` is not specified, the default ID will be a string UUID.**
 *
 * @field type - The type of the default ID.
 *
 * @public
 */
export interface CollectionDefaultIdOptions {
  /**
   * The type of the default ID that the API should generate if no ID is provided in the inserted document.
   *
   * **If not specified, the default ID will be a string UUID.**
   *
   * | Type       | Description    | Example                                            |
   * |------------|----------------|----------------------------------------------------|
   * | `uuid`     | A UUID v4.     | `new UUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')` |
   * | `uuidv6`   | A UUID v6.     | `new UUID('6f752f1a-6b6d-4f3e-8e1e-2e167e3b5f3d')` |
   * | `uuidv7`   | A UUID v7.     | `new UUID('018e75ff-a07b-7b08-bb91-aa566c5abaa6')` |
   * | `objectId` | An ObjectID.   | `new ObjectId('507f1f77bcf86cd799439011')`         |
   * | default    | A string UUID. | `'f47ac10b-58cc-4372-a567-0e02b2c3d479'`           |
   *
   * @example
   * ```typescript
   * const collections = await db.createCollection('my-collections');
   *
   * // { name: 'Jessica', _id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }
   * await collections.insertOne({ name: 'Jessica' });
   *```
   *
   * @example
   * ```typescript
   * const collections = await db.createCollection('my-collections', {
   *   defaultId: { type: 'uuidv6' },
   * });
   *
   * // { name: 'Allman', _id: UUID('6f752f1a-6b6d-6f3e-8e1e-2e167e3b5f3d') }
   * await collections.insertOne({ name: 'Allman' });
   * ```
   *
   * @example
   * ```typescript
   * const collections = await db.createCollection('my-collections', {
   *   defaultId: { type: 'objectId' },
   * });
   *
   * // { name: 'Brothers', _id: ObjectId('507f1f77bcf86cd799439011') }
   * await collections.insertOne({ name: 'Brothers' });
   * ```
   *
   * @remarks Make sure you're keeping this all in mind if you're specifically typing your _id field.
   */
  type: 'uuid' | 'uuidv6' | 'uuidv7' | 'objectId';
}
