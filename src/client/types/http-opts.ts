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

import type { Fetcher } from '@/src/lib';

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