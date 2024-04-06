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

import { DataAPIClientEvents } from '@/src/client/data-api-client';
import TypedEmitter from 'typed-emitter';

/**
 * The caller information to send with requests, of the form `[name, version?]`, or an array of such.
 *
 * **Intended generally for integrations or frameworks that wrap the client.**
 *
 * Used to identify the client making requests to the server.
 *
 * It will be sent in the headers of the request as such:
 * ```
 * User-Agent: ...<name>/<version> astra-db-ts/<version>
 * ```
 *
 * If no caller information is provided, the client will simply be identified as `astra-db-ts/<version>`.
 *
 * **NB. If providing an array of callers, they should be ordered from most important to least important.**
 */
export type Caller = [name: string, version?: string];

/**
 * The default options for the {@link DataAPIClient}. The Data API & DevOps specific options may be overridden
 * when spawning a new instance of their respective classes.
 */
export interface RootClientOptions {
  /**
   * The caller information to send with requests, of the form `[name, version?]`, or an array of such.
   *
   * **Intended generally for integrations or frameworks that wrap the client.**
   *
   * The caller information is used to identify the client making requests to the server.
   *
   * It will be sent in the headers of the request as such:
   * ```
   * User-Agent: ...<name>/<version> astra-db-ts/<version>
   * ```
   *
   * If no caller information is provided, the client will simply be identified as `astra-db-ts/<version>`.
   *
   * **NB. If providing an array of callers, they should be ordered from most important to least important.**
   * @example
   * ```typescript
   * // 'my-app/1.0.0 astra-db-ts/1.0.0'
   * const client1 = new DataAPIClient('AstraCS:...', {
   *   caller: ['my-app', '1.0.0'],
   * });
   *
   * // 'my-app/1.0.0 my-other-app astra-db-ts/1.0.0'
   * const client2 = new DataAPIClient('AstraCS:...', {
   *   caller: [['my-app', '1.0.0'], ['my-other-app']],
   * });
   * ```
   */
  caller?: Caller | Caller[],
  /**
   * The default options when spawning a {@link Db} instance.
   */
  dbOptions?: DbSpawnOptions,
  /**
   * The default options when spawning an {@link AstraAdmin} instance.
   */
  adminOptions?: AdminSpawnOptions,
}

/**
 * The options available spawning a new {@link Db} instance.
 *
 * If any of these options are not provided, the client will use the default options provided by the {@link DataAPIClient}.
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
   * Whether to use HTTP/2 for requests.
   *
   * Both versions are typically interchangeable, but HTTP2 is generally recommended for better performance. However,
   * some errors may differ between the two versions, due to different underlying implementations.
   *
   * Defaults to `true` if never provided. However, if it was provided when creating the {@link DataAPIClient}, it will
   * default to that value instead.
   *
   * @defaultValue true
   */
  useHttp2?: boolean,
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

/**
 * The options available spawning a new {@link AstraAdmin} instance.
 *
 * **Note that this is only available when using Astra as the underlying database.**
 *
 * If any of these options are not provided, the client will use the default options provided by the {@link DataAPIClient}.
 */
export interface AdminSpawnOptions {
  /**
   * Whether to monitor commands for {@link AstraAdmin}-level & {@link DbAdmin}-level events through an event emitter.
   *
   * Defaults to `false` if never provided. However, if it was provided when creating the {@link DataAPIClient}, it will
   * default to that value instead.
   *
   * @example
   * ```typescript
   * const client = new DataAPIClient('*TOKEN*', {
   *   devopsOptions: {
   *     monitorCommands: true,
   *   },
   * });
   *
   * client.on('adminCommandStarted', (e) => {
   *   console.log(`Running command ${e.method} ${e.path}`);
   * });
   *
   * client.on('adminCommandPolling', (e) => {
   *   console.log(`Command ${e.method} ${e.path} running for ${e.elapsed}ms`);
   * });
   *
   * client.on('adminCommandSucceeded', (e) => {
   *   console.log(`Command ${e.method} ${e.path} took ${e.duration}ms`);
   * });
   *
   * client.on('adminCommandFailed', (e) => {
   *   console.error(`Command ${e.method} ${e.path} failed w/ error ${e.error}`);
   * });
   *
   * const admin = client.admin();
   *
   * // Logs:
   * // - Running command POST /databases
   * // - Command POST /databases running for <time>ms [x10]
   * // - Command POST /databases succeeded in <time>ms
   * await admin.createDatabase({ ... });
   * ```
   *
   * @defaultValue false
   *
   * @see AdminCommandEvents
   */
  monitorCommands?: boolean,
  /**
   * The access token for the DevOps API, typically of the format `'AstraCS:...'`.
   *
   * If never provided, this will default to the token provided when creating the {@link DataAPIClient}.
   *
   * May be useful for if you want to use a stronger token for the DevOps API than the Data API.
   *
   * @example
   * ```typescript
   * const client = Projection'weak-token');
   *
   * // Using 'weak-token' as the token
   * const db = client.db();
   *
   * // Using 'strong-token' instead of 'weak-token'
   * const admin = client.admin({ adminToken: 'strong-token' });
   * ```
   */
  adminToken?: string,
  /**
   * The base URL for the devops API, which is typically always going to be the following:
   * ```
   * https://api.astra.datastax.com/v2
   * ```
   */
  endpointUrl?: string,
}

export interface InternalRootClientOpts {
  caller?: Caller | Caller[],
  emitter: TypedEmitter<DataAPIClientEvents>,
  dbOptions: DbSpawnOptions & {
    token: string,
    monitorCommands: boolean,
  },
  adminOptions: AdminSpawnOptions & {
    adminToken: string,
    monitorCommands: boolean,
  },
}
