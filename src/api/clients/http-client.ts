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
import { FetchCtx, ResponseInfo } from '@/src/api/fetch/types';
import { HTTPRequestInfo, InternalHTTPClientOptions } from '@/src/api/clients/types';

/**
 * @internal
 */
export abstract class HttpClient {
  readonly baseUrl: string;
  readonly emitter: TypedEmitter<DataAPIClientEvents>;
  readonly monitorCommands: boolean;
  readonly fetchCtx: FetchCtx;
  readonly #applicationToken: string;
  readonly baseHeaders: Record<string, any>;

  protected constructor(options: InternalHTTPClientOptions) {
    this.#applicationToken = options.applicationToken;
    this.baseUrl = options.baseUrl;
    this.emitter = options.emitter;
    this.monitorCommands = options.monitorCommands;
    this.fetchCtx = options.fetchCtx;

    if (options.baseApiPath) {
      this.baseUrl += '/' + options.baseApiPath;
    }

    this.baseHeaders = options.mkAuthHeader?.(this.#applicationToken) ?? {};
  }

  public get applicationToken(): string {
    return this.#applicationToken;
  }

  protected async _request(info: HTTPRequestInfo): Promise<ResponseInfo> {
    if (this.fetchCtx.closed.ref) {
      throw new Error('Can\'t make requests on a closed client');
    }

    if (info.timeoutManager.msRemaining <= 0) {
      throw info.timeoutManager.mkTimeoutError(info.url);
    }

    const params = info.params ?? {};
    Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

    const url = (Object.keys(params).length > 0)
      ? `${info.url}?${new URLSearchParams(params).toString()}`
      : info.url;

    return await this.fetchCtx.preferred.fetch(url, {
      body: info.data as string,
      method: info.method,
      timeoutManager: info.timeoutManager,
      headers: this.baseHeaders,
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
      ? caller
      : [caller]
  ) as Caller[];

  const callerString = callers.map((c) => {
    return c[1] ? `${c[0]}/${c[1]}` : c[0];
  }).join(' ');

  return `${RAGSTACK_REQUESTED_WITH} ${callerString} ${CLIENT_USER_AGENT}`.trim();
}
