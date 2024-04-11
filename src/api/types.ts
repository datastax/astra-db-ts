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

import { TimeoutManager } from '@/src/api/timeout-managers';
import { HttpMethods } from '@/src/api/constants';
import TypedEmitter from 'typed-emitter';
import { DataAPICommandEvents } from '@/src/data-api/events';
import { context, Response } from 'fetch-h2';
import { Headers } from 'fetch-h2/dist/lib/headers';

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
export interface FetchCtx {
  preferred: ReturnType<typeof context>,
  http1: ReturnType<typeof context>,
  preferredType: 'http1' | 'http2',
  closed: { ref: boolean },
}

/**
 * @internal
 */
export interface InternalFetchCtx {
  preferred: ReturnType<typeof context>,
  closed: { ref: boolean },
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
  headers: Headers,
  status: number,
}

/**
 * @internal
 */
export type ResponseWithBody = Response & { body: string };

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
