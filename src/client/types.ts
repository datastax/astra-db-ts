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

import type { DataAPIClientEvents } from '@/src/client/data-api-client';
import type TypedEmitter from 'typed-emitter';
import type { FetchCtx, Fetcher } from '@/src/lib/api/fetch/types';
import type { AdminSpawnOptions } from '@/src/administration';
import type { DataAPIEnvironment, TokenProvider } from '@/src/lib';

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
 *
 * @public
 */
export type Caller = [name: string, version?: string];

export type DataAPILoggingConfig = DataAPILoggingEvent | readonly (DataAPILoggingEvent | DataAPIExplicitLoggingConfig)[]

export type DataAPILoggingEvent = 'all' | | keyof DataAPIClientEvents;
export type DataAPILoggingOutput = 'event' | 'stdout' | 'stderr';

export interface DataAPIExplicitLoggingConfig {
  readonly events: DataAPILoggingEvent | readonly DataAPILoggingEvent[],
  readonly emits?: DataAPILoggingOutput | readonly DataAPILoggingOutput[] | null,
}

/**
 * The default options for the {@link DataAPIClient}. The Data API & DevOps specific options may be overridden
 * when spawning a new instance of their respective classes.
 *
 * @public
 */
export interface DataAPIClientOptions {
  log?: DataAPILoggingConfig,
  /**
   * Sets the Data API "backend" that is being used (e.g. 'dse', 'hcd', 'cassandra', or 'other'). Defaults to 'astra'.
   *
   * Generally, the majority of operations stay the same between backends. However, authentication may differ, and
   * availability of admin operations does as well.
   *
   * - With Astra databases, you'll use an `'AstraCS:...'` token; for other backends, you'll generally want to use the
   *   {@link UsernamePasswordTokenProvider}, or, rarely, even create your own.
   *
   * - {@link AstraAdmin} is only available on Astra databases. {@link AstraDbAdmin} is also only available on Astra
   *   databases, but the {@link DataAPIDbAdmin} alternative is used for all other backends, albeit the expense of a
   *   couple extra features.
   *
   * - Some functions/properties may also not be available on non-Astra backends, such as {@link Db.id} or {@link Db.info}.
   *
   * @remarks
   * No error will be thrown if this is set incorrectly, but bugs may appear in your code, with some operations just
   * throwing errors and refusing to work properly.
   *
   * @defaultValue "astra"
   */
  environment?: DataAPIEnvironment,
  /**
   * The client-wide options related to http operations.
   *
   * There are four different behaviours for setting the client:
   * - Not setting the `httpOptions` at all
   * -- This will attempt to use `fetch-h2` if available, and fall back to `fetch` if not available
   * - `client: 'default'` or `client: undefined` (or unset)
   * -- This will attempt to use `fetch-h2` if available, and throw an error if not available
   * - `client: 'fetch'`
   * -- This will always use the native `fetch` API
   * - `client: 'custom'`
   * -- This will allow you to pass a custom `Fetcher` implementation to the client
   *
   * `fetch-h2` is a fetch implementation that supports HTTP/2, and is the recommended client for the best performance.
   *
   * However, it's generally only available by default on node runtimes; in other environments, you may need to use the
   * native `fetch` API instead, or pass in the fetch-h2 module manually.
   *
   * See the `astra-db-ts` README for more information on different clients.
   *
   * https://github.com/datastax/astra-db-ts
   */
  httpOptions?: DataAPIHttpOptions,
  /**
   * The default options when spawning a {@link Db} instance.
   */
  dbOptions?: DbSpawnOptions,
  /**
   * The default options when spawning an {@link AstraAdmin} instance.
   */
  adminOptions?: AdminSpawnOptions,
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
}

/**
 * The options available for the {@link DataAPIClient} related to making HTTP requests.
 *
 * There are four different behaviours for setting the client:
 * - Not setting the `httpOptions` at all
 * -- This will attempt to use `fetch-h2` if available, and fall back to `fetch` if not available
 * - `client: 'default'` or `client: undefined` (or unset)
 * -- This will attempt to use `fetch-h2` if available, and throw an error if not available
 * - `client: 'fetch'`
 * -- This will always use the native `fetch` API
 * - `client: 'custom'`
 * -- This will allow you to pass a custom `Fetcher` implementation to the client
 *
 * `fetch-h2` is a fetch implementation that supports HTTP/2, and is the recommended client for the best performance.
 *
 * However, it's generally only available by default on node runtimes; on other runtimes, you may need to use the
 * native `fetch` API instead, or pass in the fetch-h2 module manually.
 *
 * See the `astra-db-ts` README for more information on different clients.
 *
 * https://github.com/datastax/astra-db-ts
 *
 * @public
 */
export type DataAPIHttpOptions =
  | DefaultHttpClientOptions
  | FetchHttpClientOptions
  | CustomHttpClientOptions;

/**
 * The options available for the {@link DataAPIClient} related to making HTTP requests using the default http client.
 *
 * If loading the default client fails, and httpOptions is set, it'll throw an {@link FailedToLoadDefaultClientError}.
 *
 * If loading the default client fails, and httpOptions is not set, it'll silently fall back to the native fetch API.
 *
 * If you're minifying your code, you'll need to provide the fetch-h2 module manually (see
 * {@link DefaultHttpClientOptions.fetchH2}).
 *
 * See the `astra-db-ts` README for more information on different clients.
 *
 * https://github.com/datastax/astra-db-ts
 *
 * @public
 */
export interface DefaultHttpClientOptions {
  /**
   * Use the default http client for making HTTP requests (currently fetch-h2).
   *
   * Leave undefined to use the default client (you don't need to specify `'default'`).
   */
  client?: 'default',
  /**
   * Whether to prefer HTTP/2 for requests to the Data API; if set to `false`, HTTP/1.1 will be used instead.
   *
   * **Note that this is only available when using the Data API; the DevOps API does not support HTTP/2**
   *
   * Both versions are generally interchangeable, but HTTP2 is generally recommended for better performance.
   *
   * Defaults to `true` if never provided.
   *
   * @defaultValue true
   */
  preferHttp2?: boolean,
  /**
   * The default maximum time in milliseconds to wait for a response from the server.
   *
   * This does *not* mean the request will be cancelled after this time, but rather that the client will wait
   * for this time before considering the request to have timed out.
   *
   * The request may or may not still be running on the server after this time.
   */
  maxTimeMS?: number,
  /**
   * Options specific to HTTP/1.1 requests.
   */
  http1?: Http1Options,
  /**
   * The fetch-h2 module to use for making HTTP requests.
   *
   * Leave undefined to use the default module.
   */
  fetchH2?: unknown,
}

/**
 * The options available for the {@link DataAPIClient} related to making HTTP requests using the native fetch API.
 *
 * This will be the fallback client if the default client fails to load/if the default client is not available.
 *
 * See the `astra-db-ts` README for more information on different clients.
 *
 * https://github.com/datastax/astra-db-ts
 *
 * @public
 */
export interface FetchHttpClientOptions {
  /**
   * Use the native fetch API for making HTTP requests.
   */
  client: 'fetch',
  /**
   * The default maximum time in milliseconds to wait for a response from the server.
   *
   * This does *not* mean the request will be cancelled after this time, but rather that the client will wait
   * for this time before considering the request to have timed out.
   *
   * The request may or may not still be running on the server after this time.
   */
  maxTimeMS?: number,
}

/**
 * Allows you to use a custom http client for making HTTP requests, rather than the default or fetch API.
 *
 * Just requires the implementation of a simple adapter interface.
 *
 * See the `astra-db-ts` README for more information on different clients.
 *
 * https://github.com/datastax/astra-db-ts
 *
 * @public
 */
export interface CustomHttpClientOptions {
  /**
   * Use a custom http client for making HTTP requests.
   */
  client: 'custom',
  /**
   * The custom "fetcher" to use.
   */
  fetcher: Fetcher,
  /**
   * The default maximum time in milliseconds to wait for a response from the server.
   *
   * This does *not* mean the request will be cancelled after this time, but rather that the client will wait
   * for this time before considering the request to have timed out.
   *
   * The request may or may not still be running on the server after this time.
   */
  maxTimeMS?: number,
}

/**
 * The options available for the {@link DataAPIClient} related to making HTTP/1.1 requests.
 *
 * @public
 */
export interface Http1Options {
  /**
   * Whether to keep the connection alive for future requests. This is generally recommended for better performance.
   *
   * Defaults to true.
   *
   * @defaultValue true
   */
  keepAlive?: boolean,
  /**
   * The delay (in milliseconds) before keep-alive probing.
   *
   * Defaults to 1000ms.
   *
   * @defaultValue 1000
   */
  keepAliveMS?: number,
  /**
   * Maximum number of sockets to allow per origin.
   *
   * Defaults to 256.
   *
   * @defaultValue 256
   */
  maxSockets?: number,
  /**
   * Maximum number of lingering sockets, waiting to be re-used for new requests.
   *
   * Defaults to Infinity.
   *
   * @defaultValue Infinity
   */
  maxFreeSockets?: number,
}

/**
 * The options available spawning a new {@link Db} instance.
 *
 * If any of these options are not provided, the client will use the default options provided by the {@link DataAPIClient}.
 *
 * @public
 */
export interface DbSpawnOptions {
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

/**
 * @internal
 */
export interface InternalRootClientOpts {
  environment: DataAPIEnvironment,
  emitter: TypedEmitter<DataAPIClientEvents>,
  fetchCtx: FetchCtx,
  userAgent: string,
  dbOptions: Omit<DbSpawnOptions, 'token'> & {
    token: TokenProvider,
    monitorCommands: boolean,
  },
  adminOptions: Omit<AdminSpawnOptions, 'adminToken'> & {
    adminToken: TokenProvider,
    monitorCommands: boolean,
  },
}
