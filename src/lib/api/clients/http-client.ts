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

import type { TypedEmitter } from '@/src/lib/typed-emitter.js';
import type { FetchCtx, FetcherResponseInfo } from '@/src/lib/api/fetch/types.js';
import type { HeaderProvider, HTTPClientOptions, HTTPRequestInfo } from '@/src/lib/api/clients/index.js';
import type { DataAPIClientEventMap } from '@/src/lib/logging/index.js';
import { Logger } from '@/src/lib/logging/logger.js';
import type { MkTimeoutError} from '@/src/lib/api/timeouts/timeouts.js';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts.js';

/**
 * @internal
 */
export abstract class HttpClient {
  readonly baseUrl: string;
  readonly emitter: TypedEmitter<DataAPIClientEventMap>;
  readonly logger: Logger;
  readonly fetchCtx: FetchCtx;
  readonly baseHeaders: Record<string, any>;
  readonly headerProviders: HeaderProvider[];
  tm: Timeouts;

  protected constructor(options: HTTPClientOptions, headerProviders: HeaderProvider[], mkTimeoutError: MkTimeoutError) {
    this.baseUrl = options.baseUrl;
    this.emitter = options.emitter;
    this.logger = new Logger(options.logging, options.emitter, console);
    this.fetchCtx = options.fetchCtx;

    if (options.baseApiPath) {
      this.baseUrl += '/' + options.baseApiPath;
    }

    this.baseHeaders = { ...options.additionalHeaders };
    this.baseHeaders['User-Agent'] = options.caller.userAgent;
    this.baseHeaders['Content-Type'] = 'application/json';

    this.headerProviders = headerProviders;
    this.tm = new Timeouts(mkTimeoutError, options.timeoutDefaults);
  }

  protected async _request(info: HTTPRequestInfo): Promise<FetcherResponseInfo> {
    if (this.fetchCtx.closed.ref) {
      throw new Error('Can\'t make requests on a closed client');
    }

    const [msRemaining, mkTimeoutError] = info.timeoutManager.advance(info);

    if (msRemaining <= 0) {
      throw mkTimeoutError();
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
      mkTimeoutError,
    });
  }
}
