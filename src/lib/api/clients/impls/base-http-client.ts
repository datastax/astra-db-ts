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
import type { HttpMethodStrings } from '@/src/lib/api/clients/index.js';
import type { TimeoutAdapter, TimeoutDescriptor } from '@/src/lib/api/timeouts/timeouts.js';
import { type TimeoutManager, Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { DataAPIClientEventMap, HierarchicalLogger } from '@/src/lib/index.js';
import { type CommandOptions, HeadersProvider } from '@/src/lib/index.js';
import type { HeadersResolverAdapter } from '@/src/lib/api/clients/utils/headers-resolver.js';
import { HeadersResolver } from '@/src/lib/api/clients/utils/headers-resolver.js';
import type { ParsedTimeoutDescriptor } from '@/src/lib/api/timeouts/cfg-handler.js';
import type { ParsedCaller } from '@/src/client/opts-handlers/caller-cfg-handler.js';
import type { ParsedHeadersProviders } from '@/src/lib/headers-providers/root/opts-handlers.js';
import type { RetryAdapter } from '@/src/lib/api/retries/manager.js';
import { RetryManager } from '@/src/lib/api/retries/manager.js';
import type { ParsedTokenProvider } from '@/src/lib/token-providers/token-provider.js';
import type { RetryContext } from '@/src/lib/api/retries/contexts/base.js';
import { RequestId } from '@/src/lib/api/clients/utils/request-id.js';

/**
 * @internal
 */
export interface BaseHTTPClientOptions {
  baseUrl: string,
  logger: HierarchicalLogger<DataAPIClientEventMap>,
  fetchCtx: FetchCtx,
  caller: ParsedCaller,
  additionalHeaders: ParsedHeadersProviders,
  timeoutDefaults: ParsedTimeoutDescriptor,
  tokenProvider: ParsedTokenProvider,
}

/**
 * @internal
 */
export interface BaseExecuteOperationOptions {
  timeoutManager: TimeoutManager,
}

/**
 * @internal
 */
export interface BaseRequestMetadata {
  timeout: Partial<TimeoutDescriptor>,
  requestId: RequestId,
  startTime: number,
}

/**
 * @internal
 */
export interface HTTPRequestInfo {
  url: string,
  data?: string,
  params?: Record<string, string>,
  method: HttpMethodStrings,
  timeoutManager: TimeoutManager,
  forceHttp1?: boolean,
}

/**
 * @internal
 */
export interface HttpClientAdapters<Metadata extends BaseRequestMetadata> {
  retryAdapter: RetryAdapter<RetryContext, Metadata>,
  headersResolverAdapter: HeadersResolverAdapter,
  timeoutAdapter: TimeoutAdapter,
}

/**
 * @internal
 */
export abstract class BaseHttpClient<Metadata extends BaseRequestMetadata> {
  protected readonly _baseUrl: string;
  protected readonly _logger: HierarchicalLogger<DataAPIClientEventMap>;
  protected readonly _fetchCtx: FetchCtx;
  protected readonly _headersResolver: HeadersResolver;

  public readonly tm: Timeouts;
  public readonly rm: (isSafelyRetryable: boolean, opts: CommandOptions) => RetryManager<Metadata>;

  protected constructor(opts: BaseHTTPClientOptions, adapters: HttpClientAdapters<Metadata>) {
    this._baseUrl = opts.baseUrl;
    this._logger = opts.logger;
    this._fetchCtx = opts.fetchCtx;

    const additionalHeaders = HeadersProvider.opts.fromObj.concat([
      opts.additionalHeaders,
      opts.tokenProvider.toHeadersProvider(),
    ]);

    this._headersResolver = new HeadersResolver(adapters.headersResolverAdapter, additionalHeaders, {
      'User-Agent': opts.caller.userAgent,
      'Content-Type': 'application/json',
    });

    this.tm = new Timeouts(adapters.timeoutAdapter, opts.timeoutDefaults);

    this.rm = (isSafelyRetryable: boolean, opts: CommandOptions) => {
      return RetryManager.mk(isSafelyRetryable, opts, adapters.retryAdapter, undefined);
    };
  }

  protected _mkRequestMetadata(tm: TimeoutManager, metadata: Omit<Metadata, keyof BaseRequestMetadata>): Metadata {
    return {
      ...metadata,
      requestId: new RequestId(),
      startTime: performance.now(),
      timeout: tm.initial(),
    } as Metadata;
  }

  protected async _request(info: HTTPRequestInfo): Promise<FetcherResponseInfo> {
    if (this._fetchCtx.closed.ref) {
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

    const maybePromiseHeaders = this._headersResolver.resolve();

    const headers = (maybePromiseHeaders instanceof Promise)
      ? await maybePromiseHeaders
      : maybePromiseHeaders;

    return await this._fetchCtx.ctx.fetch({
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
