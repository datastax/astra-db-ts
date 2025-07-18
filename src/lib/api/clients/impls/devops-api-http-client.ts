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

import type {
  BaseExecuteOperationOptions,
  BaseHTTPClientOptions,
  BaseRequestMetadata,
  HttpMethodStrings,
} from '@/src/lib/api/clients/index.js';
import { BaseHttpClient, type HTTPRequestInfo } from '@/src/lib/api/clients/index.js';
import { DevOpsAPIResponseError, DevOpsAPITimeoutError } from '@/src/administration/errors.js';
import type { AstraAdminBlockingOptions } from '@/src/administration/types/index.js';
import { HttpMethods } from '@/src/lib/api/constants.js';
import { jsonTryParse } from '@/src/lib/utils.js';
import type { TimedOutCategories, TimeoutAdapter } from '@/src/lib/api/timeouts/timeouts.js';
import { NonErrorError } from '@/src/lib/errors.js';
import { DevOpsAPIRetryAdapter } from '@/src/lib/api/retries/adapters/devops-api.js';
import type { HeadersResolverAdapter } from '@/src/lib/api/clients/utils/headers-resolver.js';

/**
 * @internal
 */
export type DevOpsAPIHttpClientOpts = BaseHTTPClientOptions

/**
 * @internal
 */
export interface ExecuteDevOpsAPIOperationOptions extends BaseExecuteOperationOptions {
  path: string,
  method: HttpMethodStrings,
  data?: Record<string, any>,
  params?: Record<string, string>,
  methodName: `${'admin' | 'dbAdmin'}.${string}`,
}

/**
 * @internal
 */
export interface LongRunningOperationOptions {
  id: string | ((resp: RawDevOpsAPIResponse) => string),
  target: string,
  legalStates: string[],
  defaultPollInterval: number,
  options: AstraAdminBlockingOptions | undefined,
}

/**
 * @internal
 */
export interface DevOpsAPIRequestMetadata extends BaseRequestMetadata {
  reqOpts: ExecuteDevOpsAPIOperationOptions,
  baseUrl: string,
  isLongRunning: boolean,
  methodName: string,
}

/**
 * @internal
 */
export interface RawDevOpsAPIResponse {
  data?: Record<string, any>,
  headers: Record<string, string>,
  status: number,
}

/**
 * @internal
 */
export class DevOpsAPIHttpClient extends BaseHttpClient<DevOpsAPIRequestMetadata> {
  constructor(opts: DevOpsAPIHttpClientOpts) {
    super(opts, {
      retryAdapter: new DevOpsAPIRetryAdapter(opts.logger),
      headersResolverAdapter: DevOpsAPIHeadersResolverAdapter,
      timeoutAdapter: DevOpsAPITimeoutAdapter,
    });
  }

  public async request(opts: ExecuteDevOpsAPIOperationOptions): Promise<RawDevOpsAPIResponse> {
    return this._executeOperation(opts);
  }

  public async requestLongRunning(opts: ExecuteDevOpsAPIOperationOptions, lrInfo: LongRunningOperationOptions): Promise<RawDevOpsAPIResponse> {
    return this._executeOperation(opts, lrInfo);
  }

  private async _executeOperation(opts: ExecuteDevOpsAPIOperationOptions, lrInfo?: LongRunningOperationOptions): Promise<RawDevOpsAPIResponse> {
    const metadata = this._mkRequestMetadata(opts.timeoutManager, {
      baseUrl: this._baseUrl,
      isLongRunning: !!lrInfo && lrInfo.options?.blocking !== false,
      methodName: opts.methodName,
      reqOpts: opts,
    });

    this._logger.internal.adminCommandStarted?.(metadata);

    try {
      const resp = await this._makeRequest(opts);

      if (metadata.isLongRunning) {
        const id = (typeof lrInfo!.id === 'function')
          ? lrInfo!.id(resp)
          : lrInfo!.id;

        await this._awaitStatus(id, opts, lrInfo!, metadata);
      }

      this._logger.internal.adminCommandSucceeded?.(metadata, resp.data);

      return resp;
    } catch (thrown) {
      const err = NonErrorError.asError(thrown);
      this._logger.internal.adminCommandFailed?.(metadata, err);
      throw err;
    }
  }

  private async _awaitStatus(id: string, opts: ExecuteDevOpsAPIOperationOptions, lrInfo: LongRunningOperationOptions, metadata: DevOpsAPIRequestMetadata) {
    if (lrInfo.options?.blocking === false) {
      return;
    }

    const pollInterval = lrInfo.options?.pollInterval || lrInfo.defaultPollInterval;
    let waiting = false;

    for (let i = 1; i++;) {
      /* c8 ignore next 3: exceptional case that can't be manually reproduced */
      if (waiting) {
        continue;
      }
      waiting = true;

      this._logger.internal.adminCommandPolling?.(metadata, pollInterval, i);

      const resp = await this._makeRequest({
        method: HttpMethods.Get,
        path: `/databases/${id}`,
        methodName: opts.methodName,
        timeoutManager: opts.timeoutManager,
      });

      if (resp.data?.status === lrInfo.target) {
        break;
      }

      /* c8 ignore start: exceptional case that can't be manually reproduced */
      if (!lrInfo.legalStates.includes(resp.data?.status)) {
        const okStates = [lrInfo.target, ...lrInfo.legalStates];
        throw new Error(`Created database is not in any legal state [${okStates.join(',')}]; current state: ${resp.data?.status}`);
      }
      /* c8 ignore end */

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          waiting = false;
          resolve();
        }, pollInterval);
      });
    }
  }

  private async _makeRequest(opts: ExecuteDevOpsAPIOperationOptions): Promise<RawDevOpsAPIResponse> {
    const url = this._baseUrl + opts.path;

    const resp = await this._request({
      url: url,
      method: opts.method,
      params: opts.params,
      data: JSON.stringify(opts.data),
      forceHttp1: true,
      timeoutManager: opts.timeoutManager,
    });

    const data = resp.body ? jsonTryParse(resp.body, undefined) : undefined;

    if (resp.status >= 400) {
      throw new DevOpsAPIResponseError(resp, data);
    }

    return {
      data: data,
      status: resp.status,
      headers: resp.headers,
    };
  }
}

/**
 * @internal
 */
const DevOpsAPIHeadersResolverAdapter: HeadersResolverAdapter = {
  target: 'devops-api',
};

/**
 * @internal
 */
const DevOpsAPITimeoutAdapter: TimeoutAdapter = {
  mkTimeoutError(info: HTTPRequestInfo, categories: TimedOutCategories): Error {
    return new DevOpsAPITimeoutError(info, categories);
  },
};
