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

import type { FetchCtx } from '@/src/lib/api/fetch/fetcher.js';
import type { HttpMethods } from '@/src/lib/api/constants.js';
import type { Ref } from '@/src/lib/types.js';
import type { MkTimeoutError, TimeoutManager } from '@/src/lib/api/timeouts/timeouts.js';
import type { ParsedTimeoutDescriptor } from '@/src/lib/api/timeouts/cfg-handler.js';
import type { ParsedCaller } from '@/src/client/opts-handlers/caller-cfg-handler.js';
import type { DataAPIClientEventMap, HierarchicalLogger } from '@/src/lib/index.js';
import type { ParsedHeadersProviders } from '@/src/lib/headers-providers/root/opts-handlers.js';

/**
 * @internal
 */
export interface HTTPClientOptions {
  baseUrl: string,
  baseApiPath?: string | null,
  logger: HierarchicalLogger<DataAPIClientEventMap>,
  fetchCtx: FetchCtx,
  caller: ParsedCaller,
  additionalHeaders: ParsedHeadersProviders,
  timeoutDefaults: ParsedTimeoutDescriptor,
  mkTimeoutError: MkTimeoutError,
}

/**
 * @internal
 */
export type HttpMethodStrings = typeof HttpMethods[keyof typeof HttpMethods];

/**
 * @internal
 */
export type KeyspaceRef = Ref<string | undefined>;

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
