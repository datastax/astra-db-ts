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

/**
 * A simple adapter interface that allows you to define a custom http client that `astra-db-ts` may use to make requests.
 *
 * See [FetchH2](https://github.com/datastax/astra-db-ts/blob/master/src/api/fetch/fetch-h2.ts) and
 * [FetchNative](https://github.com/datastax/astra-db-ts/blob/master/src/api/fetch/fetch-native.ts) for example
 * implementations.
 *
 * @public
 */
export interface Fetcher {
  /**
   * Makes the actual API request for the given request information. Please take all request information into account
   * when making the request, or you may run into errors or unexpected behavior from your implementation.
   *
   * @param info - The request information (url, body, method, headers, etc.)
   */
  fetch(info: FetcherRequestInfo): Promise<FetcherResponseInfo>,
  /**
   * Optional method which may destroy any resources, if necessary. Called on {@link DataAPIClient.close}.
   */
  close?(): Promise<void>,
}

/**
 * The information required to make a request with a {@link Fetcher}. Please take all request information into account
 * when making the request, or you may run into errors or unexpected behavior from your implementation.
 *
 * @public
 */
export interface FetcherRequestInfo {
  /**
   * The full URL to make the request to.
   */
  url: string,
  /**
   * The JSON.stringified body of the request, if it exists. Make sure you're settings the content-type
   * as `application/json` if applicable.
   */
  body: string | undefined,
  /**
   * The HTTP method to use for the request.
   */
  method: 'DELETE' | 'GET' | 'POST',
  /**
   * The base headers to include in the request (you may add or even override your own as necessary)
   */
  headers: Record<string, string>,
  /**
   * Whether to force HTTP/1.1 for the request. This is important as the DevOps API does not support HTTP/2, and thus
   * you may need to force HTTP/1.1 for certain requests if you're using a client that prefers HTTP/2.
   */
  forceHttp1: boolean | undefined,
  /**
   * Creates the timeout error for the request (you may need to first catch your own timeout error and then call this
   * method to create the new ubiquitous error).
   */
  mkTimeoutError: () => Error,
  /**
   * The timeout in milliseconds for the request.
   */
  timeout: number,
}

/**
 * Response object from an API call.
 *
 * @public
 */
export interface FetcherResponseInfo {
  /**
   * The string body of the response, if it exists.
   */
  body?: string,
  /**
   * The headers of the response.
   */
  headers: Record<string, any>,
  /**
   * The HTTP status code of the response.
   */
  status: number,
  /**
   * The HTTP version used for the request.
   */
  httpVersion: 1 | 2,
  /**
   * The URL that the request was made to.
   */
  url: string,
  /**
   * The status text for the response.
   */
  statusText: string,
/**
   * Any additional attributes that may be included in the response (for use w/ custom {@link Fetcher} implementations).
   */
  additionalAttributes?: Record<string, any>,
}

/**
 * @internal
 */
export interface FetchCtx {
  ctx: Fetcher,
  closed: { ref: boolean },
  maxTimeMS: number | undefined,
}
