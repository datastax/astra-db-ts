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

/**
 * The options available spawning a new {@link Db} instance.
 *
 * If any of these options are not provided, the client will use the default options provided by the {@link DataAPIClient}.
 *
 * @public
 */
export interface DbSpawnOptions {
  /**
   * The namespace (aka keyspace) to use for the database.
   *
   * Defaults to `'default_keyspace'`. if never provided. However, if it was provided when creating the
   * {@link DataAPIClient}, it will default to that value instead.
   *
   * Every db method will use this namespace as the default namespace, but they all allow you to override it
   * in their options.
   *
   * @example
   * ```typescript
   * const client = new DataAPIClient('AstraCS:...');
   *
   * // Using 'default_keyspace' as the namespace
   * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
   *
   * // Using 'my_namespace' as the namespace
   * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
   *   namespace: 'my_keyspace',
   * });
   *
   * // Finds 'my_collection' in 'default_keyspace'
   * const coll1 = db1.collection('my_collection');
   *
   * // Finds 'my_collection' in 'my_namespace'
   * const coll2 = db1.collection('my_collection');
   *
   * // Finds 'my_collection' in 'other_keyspace'
   * const coll3 = db1.collection('my_collection', { namespace: 'other_keyspace' });
   * ```
   *
   * @defaultValue 'default_keyspace'
   */
  namespace?: string,
  /**
   * Whether to monitor commands for {@link Db}-level & {@link Collection}-level events through an event emitter.
   *
   * Defaults to `false` if never provided. However, if it was provided when creating the {@link DataAPIClient}, it will
   * default to that value instead.
   *
   * @example
   * ```typescript
   * const client = new DataAPIClient('*TOKEN*', {
   *   dbOptions: {
   *     monitorCommands: true,
   *   },
   * });
   *
   * client.on('commandStarted', (event) => {
   *   console.log(`Running command ${event.commandName}`);
   * });
   *
   * client.on('commandSucceeded', (event) => {
   *   console.log(`Command ${event.commandName} succeeded in ${event.duration}ms`);
   * });
   *
   * client.on('commandFailed', (event) => {
   *   console.error(`Command ${event.commandName} failed w/ error ${event.error}`);
   * });
   *
   * const db = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
   * const coll = db.collection('my_collection');
   *
   * // Logs:
   * // - Running command insertOne
   * // - Command insertOne succeeded in <time>ms
   * await coll.insertOne({ name: 'Lordi' });
   * ```
   *
   * @defaultValue false
   *
   * @see DataAPICommandEvents
   */
  monitorCommands?: boolean,
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
  token?: string,
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