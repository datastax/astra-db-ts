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

import { context, FetchInit, TimeoutError } from 'fetch-h2';
import { DataAPIClientOptions } from '@/src/client';
import { Fetcher, FetcherRequestInfo, FetcherResponseInfo } from '@/src/api/fetch/types';

export class FetchH2 implements Fetcher {
  private readonly _http1: ReturnType<typeof context>;
  private readonly _preferred: ReturnType<typeof context>;

  constructor(options: DataAPIClientOptions | undefined, preferHttp2: boolean) {
    // Sanity check, and shuts up the type checker; should actually never happen
    if (options?.httpOptions?.client !== undefined && options?.httpOptions?.client !== 'default') {
      throw new Error('FetchH2 client tried to initialize using options for a different client type.');
    }

    this._http1 = context({
      http1: {
        keepAlive: options?.httpOptions?.http1?.keepAlive,
        keepAliveMsecs: options?.httpOptions?.http1?.keepAliveMS,
        maxSockets: options?.httpOptions?.http1?.maxSockets,
        maxFreeSockets: options?.httpOptions?.http1?.maxFreeSockets,
      },
      httpsProtocols: <const>['http1'],
    });

    this._preferred = (preferHttp2)
      ? context()
      : this._http1;
  }

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
      }
    } catch (e) {
      if (e instanceof TimeoutError) {
        throw info.mkTimeoutError();
      }
      throw e;
    }
  }

  async close(): Promise<void> {
    await this._preferred.disconnectAll();
    await this._http1.disconnectAll();
  }
}
