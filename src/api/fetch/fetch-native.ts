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

import { Fetcher, FetcherRequestInfo, FetcherResponseInfo } from '@/src/api/fetch/types';

export class FetchNative implements Fetcher {
  async fetch(info: FetcherRequestInfo): Promise<FetcherResponseInfo> {
    try {
      const init = info as RequestInit;

      init.keepalive = true;
      init.signal = AbortSignal.timeout(info.timeout);

      const resp = await fetch(info.url, init);

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
    } catch (e: any) {
      if (e.name === 'TimeoutError') {
        throw info.mkTimeoutError();
      }
      if (e instanceof TypeError && e.message === 'fetch failed' && 'cause' in e) {
        throw e.cause;
      }
      throw e;
    }
  }

  async close(): Promise<void> {}
}
