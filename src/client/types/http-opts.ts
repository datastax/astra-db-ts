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

import type { Fetcher, FetchH2Like } from '@/src/lib/index.js';

/**
 * ##### Overview
 *
 * The options available for the {@link DataAPIClient} related to making HTTP requests.
 *
 * There are three different behaviours for setting the client:
 * - `client: 'fetch'` or not setting the `httpOptions` at all
 *   - This will use the native `fetch` API
 * - `client: 'fetch-h2'`
 *   - This will use the provided `fetch-h2` module for HTTP/2 requests
 * - `client: 'custom'`
 *   - This will allow you to pass a custom `Fetcher` implementation to the client
 *
 * ##### HTTP/2 support
 *
 * [`fetch-h2`](https://www.npmjs.com/package/fetch-h2) is a fetch implementation that supports HTTP/2, and may offer notable performance gains.
 *
 * However, **it is not included in the SDK by default (for compatability reasons)**; the module will need to be manually provided by the user.
 *
 * Luckily, it takes only a couple of easy steps. See {@link FetchH2HttpClientOptions} for more information.
 *
 * Alternatively, if using Node.js, you may use a custom Undici `Dispatcher` configured to use HTTP/2 with `fetch` instead. See below for more information.
 *
 * ##### Using your own {@link Fetcher} implementation
 *
 * `custom` may be used for advanced users who want to use their own fetch implementation, or modify an existing one to suit their needs.
 *
 * For example, if you want to use a custom HTTP `Agent`/`Dispatcher`, or modify `fetch`'s `RequestInit` in any way, you can easily do so by extending the {@link FetchNative} class.
 *
 * See {@link CustomHttpClientOptions} for more information.
 *
 * ##### Examples & more info
 *
 * *For advanced examples & more information, see the `examples/customize-http` & `examples/using-http2` directories in the [astra-db-ts repository](https://github.com/datastax/astra-db-ts)*
 *
 * @see {@link FetchH2HttpClientOptions}
 *
 * @public
 */
export type HttpOptions =
  | FetchH2HttpClientOptions
  | FetchHttpClientOptions
  | CustomHttpClientOptions;

/**
 * ##### Overview
 *
 * The options available for the {@link DataAPIClient} related to making HTTP requests using the `fetch-h2` http client.
 *
 * This, however, requires the `fetch-h2` module to be installed & provided by the user, for compatibility reasons, as it is not available in all environments.
 *
 * ##### Setup
 *
 * Luckily, it is only a couple of easy steps to get it working:
 *
 * First, install the `fetch-h2` module:
 *
 * ```bash
 * npm i fetch-h2 # or your favorite package manager's equiv.
 * ```
 *
 * Then, you can provide it to the client like so:
 *
 * ```typescript
 * import * as fetchH2 from 'fetch-h2';
 * // or `const fetchH2 = require('fetch-h2');`
 *
 * const client = new DataAPIClient({
 *   httpOptions: {
 *     client: 'fetch-h2',
 *     fetchH2: fetchH2,
 *   },
 * });
 * ```
 *
 * See the astra-db-ts v2.0+ README for more information on how to use `fetch-h2`, and the compatibility reasons for not including it by default.
 *
 * ##### Examples
 *
 * *For a complete example & more information, see the `examples/using-http2` directory in the [astra-db-ts repository](https://github.com/datastax/astra-db-ts)*
 *
 * @see HttpOptions
 *
 * @public
 */
export interface FetchH2HttpClientOptions {
  /**
   * Tells the Data API client to use the `fetch-h2` module for making HTTP requests.
   *
   * See {@link HttpOptions} for the other options available.
   */
  client: 'fetch-h2',
  /**
   * The fetch-h2 module to use for making HTTP requests.
   *
   * Must be provided, or an error will be thrown.
   */
  fetchH2: FetchH2Like,
  /**
   * Whether to prefer HTTP/2 for requests to the Data API; if set to `false`, HTTP/1.1 will be used instead.
   *
   * Note that this is only available for using the Data API; the DevOps API does not support HTTP/2.
   *
   * Both versions are generally interchangeable, but HTTP/2 is recommended for better performance.
   *
   * Defaults to `true` if never provided.
   *
   * @defaultValue true
   */
  preferHttp2?: boolean,
  /**
   * Options specific to HTTP/1.1 requests.
   */
  http1?: FetchH2Http1Options,
}

/**
 * ##### Overview
 *
 * The default http client used by the Data API client, which is the native `fetch` API.
 *
 * Passing in `httpOptions: { client: 'fetch' }` is equivalent to not setting the `httpOptions` at all.
 *
 * ##### Polyfilling `fetch`
 *
 * See https://github.com/BuilderIO/this-package-uses-fetch for info about polyfilling fetch for your environment.
 *
 * ##### Customizing `fetch`
 *
 * You may extend the `FetchNative` class to customize the `fetch`'s `RequestInit`, for example to use a custom Undici `Dispatcher` to further customize the HTTP options.
 *
 * See the below-mentioned `examples/customize-http` directory for examples & more information about extending `FetchNative`.
 *
 * ##### Examples
 *
 * *For advanced examples & more information, see the `examples/customize-http` directory in the [astra-db-ts repository](https://github.com/datastax/astra-db-ts)*
 *
 * @see HttpOptions
 *
 * @public
 */
export interface FetchHttpClientOptions {
  /**
   * Tells the Data API client to use the native `fetch` API for making HTTP requests.
   *
   * See {@link HttpOptions} for the other options available.
   */
  client: 'fetch',
}

/**
 * ##### Overview
 *
 * Allows you to use your own custom HTTP request strategy, rather than the default `fetch` or `fetch-h2` implementations.
 *
 * It may also be used to wrap an existing {@link Fetcher} implementation (i.e. {@link FetchNative} or {@link FetchH2}) with your own custom logic or to add extra logging/debug information.
 *
 * ##### Implementation Details
 *
 * See the {@link Fetcher} classes for details on implementing your own custom fetcher, along with a checklist of things to consider.
 *
 * Be wary of the potential for errors or unexpected behavior if you do not take all request information into account when making the request, or make some other mistake with the fetcher.
 *
 * @example
 * ```ts
 * class CustomFetcher implements Fetcher {
 *   async fetch(info: FetcherRequestInfo): Promise<FetcherResponseInfo> {
 *     // Custom fetch implementation
 *   }
 * }
 *
 * const client = new DataAPIClient({
 *   httpOptions: { client: 'custom', fetcher: new CustomFetcher() },
 * });
 * ```
 *
 * ##### Examples
 *
 * *For advanced examples & more information, see the `examples/customize-http` directory in the [astra-db-ts repository](https://github.com/datastax/astra-db-ts)*
 *
 * @see Fetcher
 * @see HttpOptions
 *
 * @public
 */
export interface CustomHttpClientOptions {
  /**
   * Tells the Data API client to use your custom "fetcher" for making HTTP requests.
   *
   * See {@link HttpOptions} for the other options available.
   */
  client: 'custom',
  /**
   * The custom "fetcher" to use.
   */
  fetcher: Fetcher,
}

/**
 * ##### Overview
 *
 * The options available for the {@link DataAPIClient} related to making HTTP/1.1 requests with `fetch-h2`.
 *
 * To set related options for `fetch`, you may use in a custom Undici `Dispatcher` (or your environment's equivalent) by extending `FetchNative` and setting `init.dispatcher`. See {@link FetchHttpClientOptions} for more information.
 *
 * @see FetchH2HttpClientOptions
 *
 * @public
 */
export interface FetchH2Http1Options {
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
