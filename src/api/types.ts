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

import type { TimeoutManager } from '@/src/api/timeout-managers';
import type { HttpMethods } from '@/src/api/constants';
import type TypedEmitter from 'typed-emitter';
import type { DataAPICommandEvents } from '@/src/data-api/events';

/**
 * @internal
 */
export interface HTTPClientOptions {
  baseUrl: string,
  baseApiPath?: string,
  applicationToken: string,
  emitter: TypedEmitter<DataAPICommandEvents>,
  monitorCommands: boolean,
  fetchCtx: FetchCtx,
}

/**
 * @internal
 */
export interface InternalHTTPClientOptions extends Omit<HTTPClientOptions, 'fetchCtx'> {
  fetchCtx: InternalFetchCtx,
  mkAuthHeader: (token: string) => Record<string, any>,
}

/**
 * @internal
 */
export interface RequestData {
  body: string,
  method: HttpMethodStrings,
  timeoutManager: TimeoutManager,
  headers: Record<string, string>,
}

/**
 * @internal
 */
export type ResponseData = CuratedAPIResponse;

/**
 * @internal
 */
export interface Fetcher {
  fetch: (input: string, init: RequestData) => Promise<ResponseData>,
  disconnectAll: () => Promise<void>,
}

/**
 * @internal
 */
export interface FetchCtx {
  preferred: Fetcher,
  http1: Fetcher,
  preferredType: 'http1' | 'http2',
  closed: { ref: boolean },
  maxTimeMS: number | undefined,
}

/**
 * @internal
 */
export interface InternalFetchCtx {
  preferred: Fetcher,
  closed: { ref: boolean },
  maxTimeMS: number | undefined,
}

/**
 * Curated response object from an API call
 *
 * @public
 */
export interface CuratedAPIResponse {
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
}

/**
 * The response format of a 2XX-status Data API call
 *
 * @public
 */
export interface RawDataAPIResponse {
  /**
   * A response data holding documents that were returned as the result of a command.
   */
  status?: Record<string, any>,
  /**
   * Status objects, generally describe the side effects of commands, such as the number of updated or inserted documents.
   */
  errors?: any[],
  /**
   * Array of objects or null (Error)
   */
  data?: Record<string, any>,
}

/**
 * @internal
 */
export interface APIResponse {
  data?: Record<string, any>,
  headers: Record<string, string>,
  status: number,
}

/**
 * @internal
 */
export type HttpMethodStrings = typeof HttpMethods[keyof typeof HttpMethods];

/**
 * @internal
 */
export interface HTTPRequestInfo {
  url: string,
  data?: unknown,
  params?: Record<string, string>,
  method: HttpMethodStrings,
  timeoutManager: TimeoutManager,
}
