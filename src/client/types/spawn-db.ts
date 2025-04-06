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

import type { LoggingConfig, TokenProvider } from '@/src/lib/index.js';
import { type TimeoutDescriptor } from '@/src/lib/index.js';
import type { CollectionSerDesConfig, TableSerDesConfig } from '@/src/documents/index.js';

/**
 * The default db options as can be specified in the {@link DataAPIClientOptions}.
 *
 * See {@link DbOptions} for more information on the available options.
 *
 * @public
 */
export type RootDbOptions = Omit<DbOptions, 'logging' | 'timeoutDefaults'>;

/**
 * The options available spawning a new {@link Db} instance.
 *
 * If any of these options are not provided, the client will use the default options provided by the {@link DataAPIClient}.
 *
 * @public
 */
export interface DbOptions {
  /**
   * The configuration for logging events emitted by the {@link DataAPIClient}.
   *
   * This can be set at any level of the major class hierarchy, and will be inherited by all child classes.
   *
   * See {@link LoggingConfig} for *much* more information on configuration, outputs, and inheritance.
   */
  logging?: LoggingConfig,
  /**
   * The keyspace to use for the database.
   *
   * There are a few rules for what the default keyspace will be:
   * 1. If a keyspace was provided when creating the {@link DataAPIClient}, it will default to that value.
   * 2. If using an `astra` database, it'll default to "default_keyspace".
   * 3. Otherwise, no default will be set, and it'll be on the user to provide one when necessary.
   *
   * The client itself will not throw an error if an invalid keyspace (or even no keyspace at all) is provided—it'll
   * let the Data API propagate the error itself.
   *
   * Every db method will use this keyspace as the default keyspace, but they all allow you to override it
   * in their options.
   *
   * @example
   * ```typescript
   * const client = new DataAPIClient('AstraCS:...');
   *
   * // Using 'default_keyspace' as the keyspace
   * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
   *
   * // Using 'my_keyspace' as the keyspace
   * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
   *   keyspace: 'my_keyspace',
   * });
   *
   * // Finds 'my_collection' in 'default_keyspace'
   * const coll1 = db1.collections('my_collection');
   *
   * // Finds 'my_collection' in 'my_keyspace'
   * const coll2 = db1.collections('my_collection');
   *
   * // Finds 'my_collection' in 'other_keyspace'
   * const coll3 = db1.collections('my_collection', { keyspace: 'other_keyspace' });
   * ```
   *
   * @defaultValue 'default_keyspace'
   */
  keyspace?: string | null,
  /**
   * The access token for the Data API, typically of the format `'AstraCS:...'`.
   *
   * If never provided, this will default to the token provided when creating the {@link DataAPIClient}.
   *
   * @example
   * ```typescript
   * const client = new DataAPIClient('strong-token');
   *
   * // Using 'strong-token' as the token
   * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
   *
   * // Using 'weaker-token' instead of 'strong-token'
   * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
   *   token: 'weaker-token',
   * });
   * ```
   */
  token?: string | TokenProvider | null,
  /**
   * The path to the Data API, which is going to be `api/json/v1` for all Astra instances. However, it may vary
   * if you're using a different Data API-compatible endpoint.
   *
   * Defaults to `'api/json/v1'` if never provided. However, if it was provided when creating the {@link DataAPIClient},
   * it will default to that value instead.
   *
   * @defaultValue 'api/json/v1'
   */
  dataApiPath?: string,
  /**
   * Advanced & currently somewhat unstable features related to customizing the client's ser/des behavior at a lower level.
   *
   * Use with caution. See official DataStax documentation for more info.
   *
   * @beta
   */
  serdes?: DbSerDesConfig,
  /**
   * ##### Overview
   *
   * The default timeout options for anything spawned by this {@link Db} instance.
   *
   * See {@link TimeoutDescriptor} for much more information about timeouts.
   *
   * @example
   * ```ts
   * // The request timeout for all operations is set to 1000ms.
   * const client = new DataAPIClient('...', {
   *   timeoutDefaults: { requestTimeoutMs: 1000 },
   * });
   *
   * // The request timeout for all operations borne from this Db is set to 2000ms.
   * const db = client.db('...', {
   *   timeoutDefaults: { requestTimeoutMs: 2000 },
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
   * - `requestTimeoutMs`: 10000
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

/**
 * ##### Overview
 *
 * The config for table/collection serialization/deserialization options.
 *
 * See {@link TableSerDesConfig} and {@link CollectionSerDesConfig} for more much information on the available options.
 *
 * Such options include:
 *  - Enabling the `mutateInPlace` optimization for serializing rows/documents
 *  - Enabling big number support for collections
 *  - Enabling "sparse data" for tables
 *  - Implementing custom serialization/deserialization logic through codecs
 *    - (e.g. custom data types, validation, etc.)
 *
 * ##### Disclaimer
 *
 * Some of these options are advanced features, and should be used with caution. It's possible to break the client's behavior by using these features incorrectly.
 *
 * Unstable features are marked in the documentation as `@alpha` or `@beta`, and may change in the future.
 *
 * @see CollectionSerDesConfig
 * @see TableSerDesConfig
 *
 * @public
 */
export interface DbSerDesConfig {
  /**
   * Advanced & currently somewhat unstable features related to customizing spawned tables' ser/des behavior at a lower level.
   *
   * Use with caution. See official DataStax documentation for more info.
   */
  table?: Omit<TableSerDesConfig, 'mutateInPlace'>,
  /**
   * Advanced & currently somewhat unstable features related to customizing spawned collections' ser/des behavior at a lower level.
   *
   * Use with caution. See official DataStax documentation for more info.
   */
  collection?: Omit<CollectionSerDesConfig, 'mutateInPlace'>,
  /**
   * ##### Overview
   *
   * Enables an optimization which allows inserted rows/documents to be mutated in-place when serializing, instead of cloning them before serialization.
   *
   * Stable. Will mutate filters & update filters as well.
   *
   * See {@link BaseSerDesConfig.mutateInPlace} for more information.
   *
   * @defaultValue false
   */
  mutateInPlace?: boolean,
}
