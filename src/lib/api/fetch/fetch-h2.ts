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

import type { context } from 'fetch-h2';
import type { FetchH2HttpClientOptions } from '@/src/client/index.js';
import type { Fetcher, FetcherRequestInfo, FetcherResponseInfo, SomeConstructor } from '@/src/lib/index.js';

/**
 * @public
 */
export interface FetchH2Like {
  TimeoutError: SomeConstructor,
  context: (...args: any[]) => any,
}

/**
 * Fetcher implementation which uses `fetch-h2` to perform HTTP/1.1 or HTTP/2 calls. Generally more performant than
 * the native fetch API, but less portable.
 *
 * @public
 */
export class FetchH2 implements Fetcher {
  /**
   * @internal
   */
  private readonly _http1: ReturnType<typeof context>;

  /**
   * @internal
   */
  private readonly _preferred: ReturnType<typeof context>;

  /**
   * @internal
   */
  private readonly _timeoutErrorCls: SomeConstructor;

  public constructor(options: FetchH2HttpClientOptions) {
    const fetchH2 = options.fetchH2;

    this._http1 = fetchH2.context({
      http1: {
        keepAlive: options.http1?.keepAlive,
        keepAliveMsecs: options.http1?.keepAliveMS,
        maxSockets: options.http1?.maxSockets,
        maxFreeSockets: options.http1?.maxFreeSockets,
      },
      httpsProtocols: ['http1'],
    });

    this._preferred = (options.preferHttp2 ?? true)
      ? fetchH2.context()
      : this._http1;

    this._timeoutErrorCls = fetchH2.TimeoutError;
  }

  /**
   * Performances the necessary HTTP request using the desired HTTP version.
   */
  public async fetch(init: FetcherRequestInfo): Promise<FetcherResponseInfo> {
    try {
      const resp = (init.forceHttp1)
        ? await this._http1.fetch(init.url, init)
        : await this._preferred.fetch(init.url, init);

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
        throw init.mkTimeoutError();
      }
      throw e;
    }
  }

  /**
   * Explicitly releases any underlying network resources held by the `fetch-h2` context.
   */
  public async close(): Promise<void> {
    await this._preferred.disconnectAll();
    await this._http1.disconnectAll();
  }
}
