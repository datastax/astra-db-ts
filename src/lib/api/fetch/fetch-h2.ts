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

import type { context, FetchInit, TimeoutError } from 'fetch-h2';
import { DefaultHttpClientOptions } from '@/src/client';
import { FailedToLoadDefaultClientError } from '@/src/client/errors';
import { Fetcher, FetcherRequestInfo, FetcherResponseInfo, nullish } from '@/src/lib';

/**
 * Fetcher implementation which uses `fetch-h2` to perform HTTP/1.1 or HTTP/2 calls. Generally more performant than
 * the native fetch API, but less portable.
 *
 * @public
 */
export class FetchH2 implements Fetcher {
  private readonly _http1: ReturnType<typeof context>;
  private readonly _preferred: ReturnType<typeof context>;
  private readonly _timeoutErrorCls: typeof TimeoutError;

  constructor(options: DefaultHttpClientOptions | undefined, preferHttp2: boolean) {
    try {
      // Complicated expression to stop Next.js and such from tracing require and trying to load the fetch-h2 client
      const [indirectRequire] = [require].map(x => x);

      const fetchH2 = validateFetchH2(options?.fetchH2) ?? indirectRequire('fetch-h2') as typeof import('fetch-h2');

      this._http1 = fetchH2.context({
        http1: {
          keepAlive: options?.http1?.keepAlive,
          keepAliveMsecs: options?.http1?.keepAliveMS,
          maxSockets: options?.http1?.maxSockets,
          maxFreeSockets: options?.http1?.maxFreeSockets,
        },
        httpsProtocols: ['http1'],
      });

      this._preferred = (preferHttp2)
        ? fetchH2.context()
        : this._http1;

      this._timeoutErrorCls = fetchH2.TimeoutError;
    } catch (e) {
      throw new FailedToLoadDefaultClientError(e as Error);
    }
  }

  /**
   * Performances the necessary HTTP request using the desired HTTP version.
   */
  async fetch(info: FetcherRequestInfo): Promise<FetcherResponseInfo> {
    const init = info as Partial<FetchInit>;

    try {
      const resp = (info.forceHttp1)
        ? await this._http1.fetch(info.url, init)
        : await this._preferred.fetch(info.url, init);

      return {
        headers: Object.fromEntries(resp.headers.entries()),
        body: await resp.text(),
        status: resp.status,
        url: resp.url,
        httpVersion: resp.httpVersion,
        statusText: resp.statusText,
      };
    } catch (e) {
      if (e instanceof this._timeoutErrorCls) {
        throw info.mkTimeoutError();
      }
      throw e;
    }
  }

  /**
   * Explicitly releases any underlying network resources held by the `fetch-h2` context.
   */
  async close(): Promise<void> {
    await this._preferred.disconnectAll();
    await this._http1.disconnectAll();
  }
}

function validateFetchH2(fetchH2: unknown): typeof import('fetch-h2') | nullish {
  if (fetchH2 === null || fetchH2 === undefined) {
    return fetchH2;
  }

  if (typeof fetchH2 !== 'object') {
    throw new TypeError('fetchH2 must be an object—did you pass in the module correctly?');
  }

  for (const prop of ['context', 'TimeoutError']) {
    if (!(prop in fetchH2)) {
      throw new TypeError(`fetchH2 missing the required '${prop}' property`);
    }
  }

  return fetchH2 as typeof import('fetch-h2');
}
