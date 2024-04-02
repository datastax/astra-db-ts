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

import { CLIENT_USER_AGENT } from '@/src/api/constants';
import { GuaranteedAPIResponse, HTTPClientOptions, HTTPRequestInfo, HTTPRequestStrategy } from '@/src/api/types';
import { HTTP1AuthHeaderFactories, HTTP1Strategy } from '@/src/api/http1';
import { HTTP2Strategy } from '@/src/api/http2';
import { Mutable } from '@/src/data-api/types/utils';
import { Caller } from '@/src/client';

/**
 * @internal
 */
export class HttpClient {
  public readonly baseUrl: string;
  public readonly userAgent: string;
  public requestStrategy: HTTPRequestStrategy;
  #applicationToken: string;

  constructor(options: HTTPClientOptions) {
    if (typeof window !== "undefined") {
      throw new Error("not for use in a web browser");
    }

    if (!options.baseUrl) {
      throw new Error("baseUrl required for initialization");
    }

    if (!options.applicationToken) {
      throw new Error("applicationToken required for initialization");
    }

    this.#applicationToken = options.applicationToken;

    this.baseUrl = options.baseUrl;

    this.requestStrategy =
      (options.requestStrategy)
        ? options.requestStrategy :
      (options.useHttp2 !== false)
        ? new HTTP2Strategy(this.baseUrl)
        : new HTTP1Strategy(HTTP1AuthHeaderFactories.DataApi);

    if (options.baseApiPath) {
      this.baseUrl += '/' + options.baseApiPath;
    }

    this.userAgent = options.userAgent ?? buildUserAgent(CLIENT_USER_AGENT, options.caller);
  }

  public close() {
    this.requestStrategy.close?.();
  }

  public isClosed(): boolean | undefined {
    return this.requestStrategy.closed;
  }

  public isUsingHttp2(): boolean {
    return this.requestStrategy instanceof HTTP2Strategy;
  }

  public cloneInto<C extends HttpClient>(cls: new (opts: HTTPClientOptions) => C, initialize: (client: Mutable<C>) => void): C {
    const clone = new cls({
      baseUrl: this.baseUrl,
      applicationToken: this.#applicationToken,
      requestStrategy: this.requestStrategy,
      userAgent: this.userAgent,
    });
    initialize(clone);
    return clone;
  }

  public set applicationToken(token: string) {
    this.#applicationToken = token;
  }

  public unsafeGetToken(): string {
    return this.#applicationToken;
  }

  protected async _request(info: HTTPRequestInfo): Promise<GuaranteedAPIResponse> {
    const fullInfo = {
      url: info.url,
      data: info.data,
      method: info.method,
      params: info.params ?? {},
      token: this.#applicationToken,
      userAgent: this.userAgent,
      timeoutManager: info.timeoutManager,
      reviver: info.reviver,
    };

    if (info.timeoutManager.msRemaining <= 0) {
      throw info.timeoutManager.mkTimeoutError(fullInfo);
    }
    return await this.requestStrategy.request(fullInfo);
  }
}

function buildUserAgent(client: string, caller?: Caller | Caller[]): string {
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

  return `${callerString} ${client}`.trim();
}
