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

import type { CuratedAPIResponse } from '@/src/api';

/**
 * @public
 */
export interface Fetcher {
  fetch(info: FetcherRequestInfo): Promise<FetcherResponseInfo>,
  close(): Promise<void>,
}

/**
 * @public
 */
export interface FetcherRequestInfo {
  url: string,
  body: string | undefined,
  method: 'DELETE' | 'GET' | 'POST',
  headers: Record<string, string>,
  forceHttp1: boolean | undefined,
  mkTimeoutError: () => Error,
  timeout: number,
}

/**
 * @public
 */
export type FetcherResponseInfo = CuratedAPIResponse;

/**
 * @internal
 */
export interface FetchCtx {
  ctx: Fetcher,
  closed: { ref: boolean },
  maxTimeMS: number | undefined,
}
