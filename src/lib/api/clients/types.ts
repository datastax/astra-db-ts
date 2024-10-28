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
import type { DataAPICommandEvents } from '@/src/documents';
import type { FetchCtx } from '@/src/lib/api/fetch/types';
import type { HttpMethods } from '@/src/lib/api/constants';
import type { Ref } from '@/src/lib/types';
import type { TimeoutManager } from '@/src/lib/api/timeout-managers';
import type { NormalizedLoggingConfig } from '@/src/lib/logging/types';

/**
 * @internal
 */
export interface HTTPClientOptions {
  baseUrl: string,
  baseApiPath?: string | null,
  emitter: TypedEmitter<DataAPICommandEvents>,
  logging: NormalizedLoggingConfig[] | undefined,
  fetchCtx: FetchCtx,
  userAgent: string,
}

/**
 * @internal
 */
export type HeaderProvider = () => (Promise<Record<string, string>> | Record<string, string>);

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
