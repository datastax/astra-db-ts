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

import type { Fetcher, FetcherRequestInfo, FetcherResponseInfo } from '@/src/lib/index.js';

/**
 * Fetcher implementation which uses the native fetch API to perform HTTP calls. Much more portable
 * than {@link FetchH2}, though may be less performant.
 *
 * @public
 */
export class FetchNative implements Fetcher {
  /**
   Performances the necessary HTTP request.
   */
  public async fetch(init: FetcherRequestInfo & RequestInit): Promise<FetcherResponseInfo> {
    try {
      const timeoutSignal = AbortSignal.timeout(init.timeout);

      init.signal = (init.signal)
        ? AbortSignal.any([init.signal, timeoutSignal])
        : timeoutSignal;

      const resp = await fetch(init.url, init);

      const headers = {} as Record<string, string>;
      resp.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        url: resp.url,
        statusText: resp.statusText,
        httpVersion: 1,
        headers: headers,
        body: await resp.text(),
        status: resp.status,
      };
    } catch (e) {
      if (e instanceof Error && e.name.includes('TimeoutError')) {
        throw init.mkTimeoutError();
      }
      if (e instanceof TypeError && e.message === 'fetch failed' && 'cause' in e) {
        throw e.cause;
      }
      throw e;
    }
  }

  /**
   * No-op since the native fetch API has no resources to clean up
   */
  public async close(): Promise<void> {}
}
