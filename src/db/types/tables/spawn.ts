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

import type { WithKeyspace } from '@/src/db/index.js';
import type {  TableSerDesConfig } from '@/src/documents/index.js';
import type { EmbeddingHeadersProvider, LoggingConfig, RerankingHeadersProvider } from '@/src/lib/index.js';
import { type TimeoutDescriptor } from '@/src/lib/index.js';

/**
 * Options for spawning a new `Table` instance through {@link db.table} or {@link db.createTable}.
 *
 * Note that these are not all the options available for when you're actually creating a table—see {@link CreateTableOptions} for that.
 *
 * @field embeddingApiKey - The embedding service's API-key/headers (for $vectorize)
 * @field timeoutDefaults - Default timeouts for all table operations
 * @field logging - Logging configuration overrides
 * @field serdes - Additional serialization/deserialization configuration
 * @field keyspace - Overrides the keyspace for the table (from the `Db`'s working keyspace).
 *
 * @public
 */
export interface TableOptions extends WithKeyspace {
  /**
   * The API key for the embedding service to use, or the {@link EmbeddingHeadersProvider} if using
   * a provider that requires it (e.g. AWS bedrock).
   */
  embeddingApiKey?: string | EmbeddingHeadersProvider,
  /**
   * The API key for the reranking service to use, or the {@link RerankingHeadersProvider} if using
   * a provider that requires it (e.g. AWS bedrock).
   */
  rerankingApiKey?: string | RerankingHeadersProvider,
  /**
   * The configuration for logging events emitted by the {@link DataAPIClient}.
   *
   * This can be set at any level of the major class hierarchy, and will be inherited by all child classes.
   *
   * See {@link LoggingConfig} for *much* more information on configuration, outputs, and inheritance.
   */
  logging?: LoggingConfig,
  /**
   * Advanced & currently somewhat unstable features related to customizing the table's ser/des behavior at a lower level.
   *
   * Use with caution. See official DataStax documentation for more info.
   *
   * @beta
   */
  serdes?: TableSerDesConfig,
  /**
   * ##### Overview
   *
   * The default timeout options for any operation performed on this {@link Table} instance.
   *
   * See {@link TimeoutDescriptor} for much more information about timeouts.
   *
   * @example
   * ```ts
   * // The request timeout for all operations is set to 1000ms.
   * const client = new DataAPIClient('...', {
   *   timeoutDefaults: { requestTimeoutMs: 1000 },
   * });
   *
   * // The request timeout for all operations borne from this Db is set to 2000ms.
   * const db = client.db('...', {
   *   timeoutDefaults: { requestTimeoutMs: 2000 },
   * });
   * ```
   *
   * ##### Inheritance
   *
   * The timeout options are inherited by all child classes, and can be overridden at any level, including the individual method level.
   *
   * Individual-method-level overrides can vary in behavior depending on the method; again, see {@link TimeoutDescriptor}.
   *
   * ##### Defaults
   *
   * The default timeout options are as follows:
   * - `requestTimeoutMs`: 15000
   * - `generalMethodTimeoutMs`: 30000
   * - `collectionAdminTimeoutMs`: 60000
   * - `tableAdminTimeoutMs`: 30000
   * - `databaseAdminTimeoutMs`: 600000
   * - `keyspaceAdminTimeoutMs`: 30000
   *
   * @see TimeoutDescriptor
   */
  timeoutDefaults?: Partial<TimeoutDescriptor>,
}
