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

import type { FetchCtx, FetcherResponseInfo } from '@/src/lib/api/fetch/fetcher.js';
import type { HTTPClientOptions, HTTPRequestInfo } from '@/src/lib/api/clients/index.js';
import type { DataAPIClientEventMap } from '@/src/lib/logging/index.js';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { HierarchicalLogger } from '@/src/lib/index.js';
import { HeadersResolver } from '@/src/lib/api/clients/headers-resolver.js';

/**
 * @internal
 */
export abstract class HttpClient {
  readonly baseUrl: string;
  readonly logger: HierarchicalLogger<DataAPIClientEventMap>;
  readonly fetchCtx: FetchCtx;
  readonly headersResolver: HeadersResolver;
  tm: Timeouts;

  protected constructor(target: 'data-api' | 'devops-api', options: HTTPClientOptions) {
    this.baseUrl = options.baseUrl;
    this.logger = options.logger;
    this.fetchCtx = options.fetchCtx;

    if (options.baseApiPath) {
      this.baseUrl += '/' + options.baseApiPath;
    }

    // this.baseHeaders = { ...options.additionalHeaders };
    // this.baseHeaders['User-Agent'] = options.caller.userAgent;
    // this.baseHeaders['Content-Type'] = 'application/json';
    //
    // this.headerProviders = headerProviders;

    this.headersResolver = new HeadersResolver(target, options.additionalHeaders, {
      'User-Agent': options.caller.userAgent,
      'Content-Type': 'application/json',
    });

    this.tm = new Timeouts(options.mkTimeoutError, options.timeoutDefaults);
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

    const maybePromiseHeaders = this.headersResolver.resolve();

    const headers = (maybePromiseHeaders instanceof Promise)
      ? await maybePromiseHeaders
      : maybePromiseHeaders;

    return await this.fetchCtx.ctx.fetch({
      url: url,
      body: info.data,
      method: info.method,
      headers: headers,
      forceHttp1: !!info.forceHttp1,
      timeout: msRemaining,
      mkTimeoutError,
    });
  }
}

