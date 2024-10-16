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

import type { TokenProvider } from '@/src/lib';
import { DataAPILoggingConfig } from '@/src/client';

export type DefaultDbSpawnOptions = Omit<DbSpawnOptions, 'logging'>;

/**
 * The options available spawning a new {@link Db} instance.
 *
 * If any of these options are not provided, the client will use the default options provided by the {@link DataAPIClient}.
 *
 * @public
 */
export interface DbSpawnOptions {
  logging?: DataAPILoggingConfig,
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
}
