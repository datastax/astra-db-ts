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

import { WithKeyspace } from '@/src/db';
import { CollectionSerDesConfig, EmbeddingHeadersProvider, SomeDoc } from '@/src/documents';
import { DataAPILoggingConfig } from '@/src/lib';

/**
 * Options for spawning a new `Collection` instance through {@link db.collection} or {@link db.createCollection}.
 *
 * Note that these are not all the options available for when you're actually creating a table—see {@link CreateCollectionOptions} for that.
 *
 * @field embeddingApiKey - The embedding service's API-key/headers (for $vectorize)
 * @field defaultMaxTimeMS - Default `maxTimeMS` for all collection operations
 * @field logging - Logging configuration overrides
 * @field serdes - Additional serialization/deserialization configuration
 *
 * @public
 */
export interface CollectionSpawnOptions<Schema extends SomeDoc> extends WithKeyspace {
  /**
   * The API key for the embedding service to use, or the {@link EmbeddingHeadersProvider} if using
   * a provider that requires it (e.g. AWS bedrock).
   */
  embeddingApiKey?: string | EmbeddingHeadersProvider | null,
  /**
   * The default `maxTimeMS` for all operations on the collection. Will override the maxTimeMS set in the DataAPIClient
   * options; it can be overridden on a per-operation basis.
   *
   * This does *not* mean the request will be cancelled after this time, but rather that the client will wait
   * for this time before considering the request to have timed out.
   *
   * The request may or may not still be running on the server after this time.
   */
  defaultMaxTimeMS?: number | null,
  /**
   * The configuration for logging events emitted by the {@link DataAPIClient}.
   *
   * This can be set at any level of the major class hierarchy, and will be inherited by all child classes.
   *
   * See {@link DataAPILoggingConfig} for *much* more information on configuration, outputs, and inheritance.
   */
  logging?: DataAPILoggingConfig,
  serdes?: CollectionSerDesConfig<Schema>,
}
