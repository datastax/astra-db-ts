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

import { CLIENT_USER_AGENT, RAGSTACK_REQUESTED_WITH } from '@/src/api/constants';
import { Caller, DataAPIClientEvents } from '@/src/client';
import TypedEmitter from 'typed-emitter';
import { FetchCtx, FetcherResponseInfo } from '@/src/api/fetch/types';
import { HeaderProvider, HTTPClientOptions, HTTPRequestInfo } from '@/src/api/clients/types';

/**
 * @internal
 */
export abstract class HttpClient {
  readonly baseUrl: string;
  readonly emitter: TypedEmitter<DataAPIClientEvents>;
  readonly monitorCommands: boolean;
  readonly fetchCtx: FetchCtx;
  readonly baseHeaders: Record<string, any>;
  readonly headerProviders: HeaderProvider[];

  protected constructor(options: HTTPClientOptions, headerProviders: HeaderProvider[]) {
    this.baseUrl = options.baseUrl;
    this.emitter = options.emitter;
    this.monitorCommands = options.monitorCommands;
    this.fetchCtx = options.fetchCtx;

    if (options.baseApiPath) {
      this.baseUrl += '/' + options.baseApiPath;
    }

    this.baseHeaders = {};
    this.baseHeaders['User-Agent'] = options.userAgent;
    this.baseHeaders['Content-Type'] = 'application/json';

    this.headerProviders = headerProviders;
  }

  protected async _request(info: HTTPRequestInfo): Promise<FetcherResponseInfo> {
    if (this.fetchCtx.closed.ref) {
      throw new Error('Can\'t make requests on a closed client');
    }

    const msRemaining = info.timeoutManager.msRemaining();

    if (msRemaining <= 0) {
      throw info.timeoutManager.mkTimeoutError(info);
    }

    const params = info.params ?? {};

    const url = (Object.keys(params).length > 0)
      ? `${info.url}?${new URLSearchParams(params).toString()}`
      : info.url;

    const reqHeaders = { ...this.baseHeaders };

    for (const provider of this.headerProviders) {
      const maybePromise = provider();

      const newHeaders = ('then' in maybePromise)
        ? await maybePromise
        : maybePromise;

      Object.assign(reqHeaders, newHeaders);
    }

    return await this.fetchCtx.ctx.fetch({
      url: url,
      body: info.data,
      method: info.method,
      headers: reqHeaders,
      forceHttp1: info.forceHttp1,
      timeout: msRemaining,
      mkTimeoutError: () => info.timeoutManager.mkTimeoutError(info),
    });
  }
}

/**
 * @internal
 */
export function hrTimeMs(): number {
  const hrtime = process.hrtime();
  return Math.floor(hrtime[0] * 1000 + hrtime[1] / 1000000);
}

/**
 * @internal
 */
export function buildUserAgent(caller: Caller | Caller[] | undefined): string {
  const callers = (
    (!caller)
      ? [] :
    Array.isArray(caller[0])
      ?  caller
      : [caller]
  ) as Caller[];

  const callerString = callers.map((c) => {
    return c[1] ? `${c[0]}/${c[1]}` : c[0];
  }).join(' ');

  return `${RAGSTACK_REQUESTED_WITH} ${callerString} ${CLIENT_USER_AGENT}`.trim();
}
