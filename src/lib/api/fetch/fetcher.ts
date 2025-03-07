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
// noinspection ExceptionCaughtLocallyJS

import type { Ref } from '@/src/lib/types.js';

/**
 * ##### Overview
 *
 * A simple adapter interface that allows you to define a custom HTTP request strategy that `astra-db-ts` may use to make requests.
 *
 * See [FetchH2](https://github.com/datastax/astra-db-ts/blob/59bc694ba162337ca68c5d52ec559f4e9c216fb0/src/lib/api/fetch/fetch-h2.ts) and
 * [FetchNative](https://github.com/datastax/astra-db-ts/blob/59bc694ba162337ca68c5d52ec559f4e9c216fb0/src/lib/api/fetch/fetch-native.ts)
 * on the `astra-db-ts` GitHub repo for example implementations.
 *
 * ##### Disclaimer
 *
 * Ensure that you take into account all request information when making the request, or you may run into errors or unexpected behavior from your implementation.
 *
 * Thorough testing is heavily recommended to ensure that your implementation works as expected.
 *
 * If desired, the `astra-db-ts` repo may be forked and have its test suite be run against your custom implementation to ensure complete compatibility.
 *
 * ##### Use cases
 *
 * You may want to use a custom `Fetcher` implementation if:
 * - You want to use a different fetch library (e.g. Axios, Superagent, etc.)
 * - You want to extend an existing fetch implementation with your own custom logic
 * - You want to add extra logging information to the response
 *
 * ##### Implementation
 *
 * It is heavily recommended that you take a look at the aforementioned implementations to get a better idea of how to implement your own.
 *
 * The basic idea is that you create a class or object implementing the `Fetcher` interface, and pass it to `httpOptions` in the `DataAPIClient` constructor.
 *
 * See the {@link Fetcher.fetch} and {@link Fetcher.close} methods for information on how to implement those methods, along with a checklist of things to consider.
 *
 * @example
 * ```ts
 * class CustomFetcher implements Fetcher {
 *   async fetch(info: FetcherRequestInfo): Promise<FetcherResponseInfo> {
 *     // Custom fetch implementation
 *   }
 *
 *   async close(): Promise<void> {
 *     // Custom cleanup logic (optional)
 *   }
 * }
 *
 * const client = new DataAPIClient({
 *   httpOptions: { client: 'custom', fetcher: new CustomFetcher() },
 * });
 * ```
 *
 * @see FetcherRequestInfo
 * @see FetcherResponseInfo
 * @see CustomHttpClientOptions
 *
 * @public
 */
export interface Fetcher {
  /**
   * ##### Overview
   *
   * Makes the actual API request for the given request information. Please take all request information into account
   * when making the request, or you may run into errors or unexpected behavior from your implementation.
   *
   * Be sure to check out {@link FetcherRequestInfo} and {@link FetcherResponseInfo} for more information on the input and output objects.
   *
   * ##### What you don't need to worry about
   *
   * - The appropriate `content-type`, `user-agent`, `Authorization`, etc., headers are already set
   * - The body (if present) has already been stringify-ed, and any query parameters, already appended to the URL
   *
   * ##### What you do need to worry about
   *
   * - Make sure the requested HTTP method is used
   *   - Only `GET`, `POST`, `DELETE`, but more may be required in the future
   * - The timeout _must_ be respected using an `AbortSignal` or another valid timeout mechanism.
   *   - e.g. `axios`'s `timeout` option
   * - If a timeout occurs, catch the error and throw `info.mkTimeoutError()` instead.
   *   - This will make a generic timeout error that's uniform between all fetchers
   *   - All other errors should be rethrown as-is
   * - The response headers should be normalized into a plain JS object
   *   - E.g.`Object.fromEntries(resp.headers.entries())`
   * - The response body should be returned as a plain string
   *   - E.g. `await resp.text()`
   * - If `info.forceHttp1` is `true`, ensure the request _only uses `HTTP/1[.1]`_, even if `HTTP/2` is supported.
   *   - This is because the DevOps API does not support `HTTP/2`
   * - Any additional information you want to add to logging output may be included in `extraLogInfo`
   *   - This will be printed if using the `stdout/stderr` {@link LoggingOutput}
   *   - This will be available in {@link BaseClientEvent.extraLogInfo} if using the `event` output
   *
   * @param info - The request information (url, body, method, headers, etc.)
   */
  fetch(info: FetcherRequestInfo): Promise<FetcherResponseInfo>,
  /**
   * ##### Overview
   *
   * This is an optional method which may destroy any resources, if necessary (open connections, etc.).
   *
   * Called on {@link DataAPIClient.close}.
   */
  close?(): Promise<void>,
}

/**
 * ##### Overview
 *
 * Represents the request information required to make an API request using a {@link Fetcher}.
 *
 * Implementers should ensure that **all request properties** are correctly handled when making a request.
 * Failing to do so may result in errors or unexpected behavior.
 *
 * ##### Key points of note
 *
 * - The URL is already formatted, including query parameters.
 * - The body (if present) is already `JSON.stringify`-ed.
 * - The appropriate headers (e.g., `content-type`, `user-agent`) are set but may be overridden.
 * - The correct HTTP method must be used.
 * - The timeout must be respected.
 * - The request may need to force HTTP/1.1 instead of HTTP/2.
 *
 * @see Fetcher
 * @see FetcherResponseInfo
 *
 * @public
 */
export interface FetcherRequestInfo {
  /**
   * ##### Overview
   *
   * The full URL to which the request should be made.
   *
   * This URL is preformatted, and already includes any necessary query parameters.
   */
  url: string,
  /**
   * ##### Overview
   *
   * The `JSON.stringify`-ed body of the request, if applicable.
   *
   * The `content-type` header is already present in {@link FetcherResponseInfo.headers}, so it's not necessary to set it yourself.
   */
  body: string | undefined,
  /**
   * ##### Overview
   *
   * The HTTP method to use for the request.
   *
   * Currently used methods:
   * - `GET`
   * - `POST`
   * - `DELETE`
   *
   * Future updates may require additional methods.
   */
  method: 'DELETE' | 'GET' | 'POST',
  /**
   * ##### Overview
   *
   * The base headers to include in the request.
   *
   * - These headers are preconfigured but may be modified or overridden as necessary.
   * - Ensure that required headers are correctly forwarded.
   *
   * ##### Included headers
   *
   * Already included headers include:
   * - Basic headers such as:
   *   - `content-type`
   *   - `user-agent`
   * - Authorization headers, such as `Authorization` or `Token`, from `token` options
   *   - e.g. {@link DataAPIClient}, {@link DbOptions.token}, or {@link AdminOptions.adminToken}
   * - Any headers from `embeddingApiKey` options
   *   - e.g. {@link CollectionOptions.embeddingApiKey} or {@link TableOptions.embeddingApiKey}
   * - Any headers from any `additionalHeaders` options
   *   - e.g. {@link DbOptions.additionalHeaders} or {@link AdminOptions.additionalHeaders}
   */
  headers: Record<string, string>,
  /**
   * ##### Overview
   *
   * Whether to force `HTTP/1[.1]` for the request.
   *
   * ##### Why this is important
   *
   * The DevOps API does not support `HTTP/2`, so such requests must only use `HTTP/1` or `HTTP/1.1`.
   */
  forceHttp1: boolean,
  /**
   * ##### Overview
   *
   * Creates a standardized timeout error for the request.
   *
   * - If the request times out, you should catch the timeout error first and throw the result of this method.
   * - This ensures a consistent error format across different fetch implementations.
   *
   * ##### Example
   *
   * As an example, this is how the {@link FetchNative} implementation handles timeouts:
   *
   * @example
   * ```ts
   * public async fetch(info: FetcherRequestInfo): Promise<FetcherResponseInfo> {
   *   try {
   *     const resp = await fetch(info.url, {
   *       signal: AbortSignal.timeout(info.timeout),
   *       ...,
   *     });
   *   } catch (e) {
   *     if (e instanceof Error && e.name === 'TimeoutError') {
   *       throw info.mkTimeoutError();
   *     }
   *     throw e;
   *   }
   * }
   * ```
   *
   * Of course, some http clients may offer a more straightforward way to handle timeouts, such as `axios`'s `timeout` option, and may have different ways to express timeouts occurring.
   *
   * Whatever the case, they should be appropriately set & handled to ensure the timeout is respected.
   */
  mkTimeoutError: () => Error,
  /**
   * ##### Overview
   *
   * The timeout duration for the request, in **milliseconds**.
   *
   * ##### Important
   * 
   * - You **must** respect this timeout using `AbortSignal` or another valid timeout mechanism.
   * - If the request exceeds this timeout, throw the error generated by `mkTimeoutError()`.
   *
   * See {@link FetcherRequestInfo.mkTimeoutError} for more information on how to handle timeouts.
   */
  timeout: number,
}

/**
 * ##### Overview
 *
 * Represents the response information returned from a request made by a {@link Fetcher}.
 *
 * ##### Key points of note
 *
 * - The request should NOT throw an error on non-2xx status codes.
 * - The body is returned as a string.
 * - The headers are normalized into a plain JavaScript object.
 * - Includes metadata such as HTTP status code, status text, and URL.
 * - The HTTP version used is explicitly specified.
 * - Additional debugging information may be included via `extraLogInfo`.
 *
 * @see Fetcher
 * @see FetcherRequestInfo
 *
 * @public
 */
export interface FetcherResponseInfo {
  /**
   * ##### Overview
   *
   * The body of the request, as a string, if present.
   *
   * May be left as _any falsy value_ if no body was present (e.g. `null`, `undefined`, `''`, etc.).
   *
   * ##### Important
   *
   * Do not attempt to parse the body or convert it to a different format. Simply return it as a string.
   *
   * For example, use `await resp.text()`, not `await resp.json()`.
   * - `resp.text()` generally returns an empty string if the body is empty, so it's perfectly safe to use.
   * - However, double check that this is true of your fetch implementation before using it.
   */
  body?: string,
  /**
   * ##### Overview
   *
   * The response headers, formatted as a plain old JavaScript object.
   *
   * ##### Important
   *
   * Ensure that the headers are correctly normalized into a plain object. They should not be returned as a `Headers` object or similar.
   *
   * You may need to do something like the following:
   *
   * @example
   * ```ts
   * const headers = Object.fromEntries(resp.headers.entries());
   *
   * // or
   *
   * const headers = {} as Record<string, string>;
   *
   * resp.headers.forEach((value, key) => {
   *   headers[key] = value;
   * });
   * ```
   */
  headers: Record<string, string>,
  /**
   * ##### Overview
   *
   * The exact HTTP status code of the response.
   * - e.g. `200`, `404`, `500`
   *
   * ##### Important
   *
   * Do not throw an error on non-2xx status codes. The response should be returned as-is.
   *
   * Catch any HTTP error thrown if necessary, and return it as a response.
   *
   * Otherwise, see if your fetch implementation has a way to disable error-ing on non-2xx status codes.
   *
   * For example, with `axios`, you can set `validateStatus: () => true` to disable this behavior.
   */
  status: number,
  /**
   * ##### Overview
   *
   * The **HTTP version** used for the request.
   *
   * **Possible values:**
   * - `1` → HTTP/1.1
   * - `2` → HTTP/2
   *
   * Ensure that this matches the `forceHttp1` flag in `FetcherRequestInfo` if applicable.
   *
   * This is just used for debugging purposes.
   */
  httpVersion: 1 | 2,
  /**
   * ##### Overview
   *
   * The URL to which the request was made.
   *
   * This may be different from the original URL if the request was redirected.
   *
   * This is just used for debugging purposes.
   */
  url: string,
  /**
   * ##### Overview
   *
   * The **status text** of the response.
   *
   * - Example values: `"OK"`, `"Not Found"`, `"Internal Server Error"`
   * - Typically corresponds to the `status` code.
   *
   * This is just used for debugging purposes.
   */
  statusText: string,
  /**
   * ##### Overview
   *
   * An optional object that may contain any extra debugging information you want to include.
   * - This will be printed if using the `stdout/stderr` {@link LoggingOutput}.
   * - This will be available in {@link BaseClientEvent.extraLogInfo} if using the `event` output.
   *
   * Note that the final `extraLogInfo` object may contain other fields as well, depending on what method was used.
   * - For example, `collection.insertMany` may set a `records` and `ordered` field in `extraLogInfo`.
   */
  extraLogInfo?: Record<string, unknown>,
}

/**
 * @internal
 */
export interface FetchCtx {
  ctx: Fetcher,
  closed: Ref<boolean>,
}
