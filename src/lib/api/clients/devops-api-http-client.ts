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

import { HttpClient } from '@/src/lib/api/clients/index.js';
import {
  DevOpsAPIResponseError,
  DevOpsAPITimeoutError,
} from '@/src/administration/errors.js';
import type { AstraAdminBlockingOptions, AstraDatabaseStatus } from '@/src/administration/types/index.js';
import { HttpMethods } from '@/src/lib/api/constants.js';
import type { HTTPClientOptions, HttpMethodStrings } from '@/src/lib/api/clients/types.js';
import { jsonTryParse } from '@/src/lib/utils.js';
import type { TimeoutManager } from '@/src/lib/api/timeouts/timeouts.js';
import { NonErrorError } from '@/src/lib/errors.js';
import { HeadersProvider } from '@/src/lib/index.js';
import type { ParsedTokenProvider } from '@/src/lib/token-providers/token-provider.js';

/**
 * @internal
 */
export interface DevOpsAPIRequestInfo {
  path: string,
  method: HttpMethodStrings,
  data?: Record<string, any>,
  params?: Record<string, string>,
  methodName: `${'admin' | 'dbAdmin'}.${string}`,
}

/**
 * @internal
 */
interface LongRunningRequestInfo {
  id: string | ((resp: DevopsAPIResponse) => string),
  target: string,
  legalStates: AstraDatabaseStatus[],
  defaultPollInterval: number,
  options: AstraAdminBlockingOptions | undefined,
  timeoutManager: TimeoutManager,
}

/**
 * @internal
 */
interface DevopsAPIResponse {
  data?: Record<string, any>,
  headers: Record<string, string>,
  status: number,
}

/**
 * @internal
 */
interface DevOpsAPIHttpClientOpts extends Omit<HTTPClientOptions, 'mkTimeoutError'> {
  tokenProvider: ParsedTokenProvider,
}

/**
 * @internal
 */
export class DevOpsAPIHttpClient extends HttpClient {
  constructor(opts: DevOpsAPIHttpClientOpts) {
    super('devops-api', {
      ...opts,
      additionalHeaders: HeadersProvider.opts.fromObj.concat([
        opts.additionalHeaders,
        opts.tokenProvider.toHeadersProvider(),
      ]),
      mkTimeoutError: DevOpsAPITimeoutError.mk,
    });
  }

  public async request(req: DevOpsAPIRequestInfo, timeoutManager: TimeoutManager, started = 0): Promise<DevopsAPIResponse> {
    return this._executeRequest(req, timeoutManager, started, this.logger.internal.generateAdminCommandRequestId());
  }

  public async requestLongRunning(req: DevOpsAPIRequestInfo, info: LongRunningRequestInfo): Promise<DevopsAPIResponse> {
    const isLongRunning = info.options?.blocking !== false;
    const timeoutManager = info.timeoutManager;

    const requestId = this.logger.internal.generateAdminCommandRequestId();

    this.logger.internal.adminCommandStarted?.(requestId, this.baseUrl, req, isLongRunning, timeoutManager.initial());

    const started = performance.now();
    const resp = await this._executeRequest(req, timeoutManager, started, requestId);

    const id = (typeof info.id === 'function')
      ? info.id(resp)
      : info.id;

    await this._awaitStatus(id, req, info, started, requestId);

    this.logger.internal.adminCommandSucceeded?.(requestId, this.baseUrl, req, isLongRunning, resp, started);

    return resp;
  }

  private async _executeRequest(req: DevOpsAPIRequestInfo, timeoutManager: TimeoutManager, started: number, requestId: string): Promise<DevopsAPIResponse> {
    const isLongRunning = started !== 0;

    try {
      const url = this.baseUrl + req.path;

      if (!isLongRunning) {
        this.logger.internal.adminCommandStarted?.(requestId, this.baseUrl, req, isLongRunning, timeoutManager.initial());
      }

      started ||= performance.now();

      const resp = await this._request({
        url: url,
        method: req.method,
        params: req.params,
        data: JSON.stringify(req.data),
        forceHttp1: true,
        timeoutManager,
      });

      const data = resp.body ? jsonTryParse(resp.body, undefined) : undefined;

      if (resp.status >= 400) {
        throw new DevOpsAPIResponseError(resp, data);
      }

      if (!isLongRunning) {
        this.logger.internal.adminCommandSucceeded?.(requestId, this.baseUrl, req, false, data, started);
      }

      return {
        data: data,
        status: resp.status,
        headers: resp.headers,
      };
    } catch (thrown) {
      const err = NonErrorError.asError(thrown);
      this.logger.internal.adminCommandFailed?.(requestId, this.baseUrl, req, isLongRunning, err, started);
      throw err;
    }
  }

  private async _awaitStatus(id: string, req: DevOpsAPIRequestInfo, info: LongRunningRequestInfo, started: number, requestId: string): Promise<void> {
    if (info.options?.blocking === false) {
      return;
    }

    const pollInterval = info.options?.pollInterval || info.defaultPollInterval;
    let waiting = false;

    for (let i = 1; i++;) {
      /* c8 ignore next 3: exceptional case that can't be manually reproduced */
      if (waiting) {
        continue;
      }
      waiting = true;

      this.logger.internal.adminCommandPolling?.(requestId, this.baseUrl, req, started, pollInterval, i);

      const resp = await this.request({
        method: HttpMethods.Get,
        path: `/databases/${id}`,
        methodName: req.methodName,
      }, info.timeoutManager, started);

      if (resp.data?.status === info.target) {
        break;
      }

      /* c8 ignore start: exceptional case that can't be manually reproduced */
      if (!info.legalStates.includes(resp.data?.status)) {
        const okStates = [info.target, ...info.legalStates];
        const error = new Error(`Created database is not in any legal state [${okStates.join(',')}]; current state: ${resp.data?.status}`);

        this.logger.internal.adminCommandFailed?.(requestId, this.baseUrl, req, true, error, started);
        throw error;
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
}
