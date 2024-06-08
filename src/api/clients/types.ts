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

import type TypedEmitter from 'typed-emitter';
import type { DataAPICommandEvents } from '@/src/data-api';
import type { FetchCtx, HttpMethods } from '@/src/api';
import type { TimeoutManager } from '@/src/api/timeout-managers';
import { nullish, TokenProvider } from '@/src/common';

/**
 * @internal
 */
export interface HTTPClientOptions {
  baseUrl: string,
  baseApiPath?: string | null,
  applicationToken: TokenProvider | nullish,
  emitter: TypedEmitter<DataAPICommandEvents>,
  monitorCommands: boolean,
  fetchCtx: FetchCtx,
  userAgent: string,
}

/**
 * @internal
 */
export type MkReqHeaders = (token: string | undefined) => Record<string, any>;

/**
 * @internal
 */
export type HttpMethodStrings = typeof HttpMethods[keyof typeof HttpMethods];

/**
 * @internal
 */
export interface HTTPRequestInfo {
  url: string,
  data?: string,
  params?: Record<string, string>,
  method: HttpMethodStrings,
  timeoutManager: TimeoutManager,
  forceHttp1?: boolean,
}
