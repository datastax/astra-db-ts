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
  DevOpsUnexpectedStateError,
} from '@/src/administration/errors.js';
import type { AstraAdminBlockingOptions } from '@/src/administration/types/index.js';
import { DEFAULT_DEVOPS_API_AUTH_HEADER, HttpMethods } from '@/src/lib/api/constants.js';
import type { HeaderProvider, HTTPClientOptions, HttpMethodStrings } from '@/src/lib/api/clients/types.js';
import type { nullish } from '@/src/lib/index.js';
import { jsonTryParse } from '@/src/lib/utils.js';
import type { TimeoutManager } from '@/src/lib/api/timeouts/timeouts.js';
import type { ParsedTokenProvider } from '@/src/lib/token-providers/token-provider.js';
import { NonErrorError } from '@/src/lib/errors.js';

/**
 * @internal
 */
export interface DevOpsAPIRequestInfo {
  path: string,
  method: HttpMethodStrings,
  data?: Record<string, any>,
  params?: Record<string, string>,
  methodName: string,
}

/**
 * @internal
 */
interface LongRunningRequestInfo {
  id: string | ((resp: DevopsAPIResponse) => string),
  target: string,
  legalStates: string[],
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
export class DevOpsAPIHttpClient extends HttpClient {
  constructor(opts: HTTPClientOptions) {
    super(opts, [mkAuthHeaderProvider(opts.tokenProvider)], DevOpsAPITimeoutError.mk);
  }

  public async request(req: DevOpsAPIRequestInfo, timeoutManager: TimeoutManager, started = 0): Promise<DevopsAPIResponse> {
    return this._executeRequest(req, timeoutManager, started, this.logger.generateAdminCommandRequestId());
  }

  public async requestLongRunning(req: DevOpsAPIRequestInfo, info: LongRunningRequestInfo): Promise<DevopsAPIResponse> {
    const isLongRunning = info.options?.blocking !== false;
    const timeoutManager = info.timeoutManager;

    const requestId = this.logger.generateAdminCommandRequestId();

    this.logger.adminCommandStarted?.(requestId, req, isLongRunning, timeoutManager.initial());

    const started = performance.now();
    const resp = await this._executeRequest(req, timeoutManager, started, requestId);

    const id = (typeof info.id === 'function')
      ? info.id(resp)
      : info.id;

    await this._awaitStatus(id, req, info, started, requestId);

    this.logger.adminCommandSucceeded?.(requestId, req, isLongRunning, resp, started);

    return resp;
  }

  private async _executeRequest(req: DevOpsAPIRequestInfo, timeoutManager: TimeoutManager, started: number, requestId: string): Promise<DevopsAPIResponse> {
    const isLongRunning = started !== 0;

    try {
      const url = this.baseUrl + req.path;

      if (!isLongRunning) {
        this.logger.adminCommandStarted?.(requestId, req, isLongRunning, timeoutManager.initial());
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
        this.logger.adminCommandSucceeded?.(requestId, req, false, data, started);
      }

      return {
        data: data,
        status: resp.status,
        headers: resp.headers,
      };
    } catch (thrown) {
      const err = NonErrorError.asError(thrown);
      this.logger.adminCommandFailed?.(requestId, req, isLongRunning, err, started);
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
      /* istanbul ignore next: exceptional case that can't be manually reproduced */
      if (waiting) {
        continue;
      }
      waiting = true;

      this.logger.adminCommandPolling?.(requestId, req, started, pollInterval, i);

      const resp = await this.request({
        method: HttpMethods.Get,
        path: `/databases/${id}`,
        methodName: req.methodName,
      }, info.timeoutManager, started);

      if (resp.data?.status === info.target) {
        break;
      }

      /* istanbul ignore next: exceptional case that can't be manually reproduced */
      if (!info.legalStates.includes(resp.data?.status)) {
        const okStates = [info.target, ...info.legalStates];
        const error = new DevOpsUnexpectedStateError(`Created database is not in any legal state [${okStates.join(',')}]`, okStates, resp.data);

        this.logger.adminCommandFailed?.(requestId, req, true, error, started);
        throw error;
      }

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          waiting = false;
          resolve();
        }, pollInterval);
      });
    }
  }
}

const mkAuthHeaderProvider = (tp: ParsedTokenProvider): HeaderProvider => () => {
  const token = tp.getToken();

  return (token instanceof Promise)
    ? token.then(mkAuthHeader)
    : mkAuthHeader(token);
};

const mkAuthHeader = (token: string | nullish): Record<string, string> => (token)
  ? { [DEFAULT_DEVOPS_API_AUTH_HEADER]: `Bearer ${token}` }
  : {};
