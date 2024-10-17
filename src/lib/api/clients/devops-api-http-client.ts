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

import { HttpClient } from '@/src/lib/api/clients/http-client';
import { DevOpsAPIResponseError, DevOpsAPITimeoutError, DevOpsUnexpectedStateError } from '@/src/administration/errors';
import { AdminBlockingOptions } from '@/src/administration/types';
import { TimeoutManager, TimeoutOptions } from '@/src/lib/api/timeout-managers';
import { DEFAULT_DEVOPS_API_AUTH_HEADER, HttpMethods } from '@/src/lib/api/constants';
import { HeaderProvider, HTTPClientOptions, HttpMethodStrings } from '@/src/lib/api/clients/types';
import { nullish, TokenProvider } from '@/src/lib';
import { jsonTryParse } from '@/src/lib/utils';

/**
 * @internal
 */
export interface DevOpsAPIRequestInfo {
  path: string,
  method: HttpMethodStrings,
  data?: Record<string, any>,
  params?: Record<string, string>,
}

interface LongRunningRequestInfo {
  id: string | ((resp: DevopsAPIResponse) => string),
  target: string,
  legalStates: string[],
  defaultPollInterval: number,
  options: AdminBlockingOptions | undefined,
}

interface DevopsAPIResponse {
  data?: Record<string, any>,
  headers: Record<string, string>,
  status: number,
}

interface DevOpsAPIHttpClientOpts extends HTTPClientOptions {
  tokenProvider: TokenProvider,
}

/**
 * @internal
 */
export class DevOpsAPIHttpClient extends HttpClient {
  constructor(opts: DevOpsAPIHttpClientOpts) {
    super(opts, [mkAuthHeaderProvider(opts.tokenProvider)]);
  }

  public async request(req: DevOpsAPIRequestInfo, options: TimeoutOptions | undefined, started: number = 0): Promise<DevopsAPIResponse> {
    const isLongRunning = started !== 0;

    try {
      const timeoutManager = options?.timeoutManager ?? this._timeoutManager(options?.maxTimeMS);
      const url = this.baseUrl + req.path;

      if (!isLongRunning) {
        this.logger.adminCommandStarted?.(req, isLongRunning, timeoutManager.ms);
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
        this.logger.adminCommandSucceeded?.(req, false, data, started);
      }

      return {
        data: data,
        status: resp.status,
        headers: resp.headers,
      };
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }
      this.logger.adminCommandFailed?.(req, isLongRunning, e, started);
      throw e;
    }
  }

  public async requestLongRunning(req: DevOpsAPIRequestInfo, info: LongRunningRequestInfo): Promise<DevopsAPIResponse> {
    const timeoutManager = this._timeoutManager(info.options?.maxTimeMS);
    const isLongRunning = info.options?.blocking !== false;

    this.logger.adminCommandStarted?.(req, isLongRunning, timeoutManager.ms);

    const started = performance.now();
    const resp = await this.request(req, { timeoutManager }, started);

    const id = (typeof info.id === 'function')
      ? info.id(resp)
      : info.id;

    await this._awaitStatus(id, req, info, timeoutManager, started);

    this.logger.adminCommandSucceeded?.(req, isLongRunning, resp, started);

    return resp;
  }

  private _timeoutManager(timeout: number | undefined) {
    timeout ??= this.fetchCtx.maxTimeMS ?? (12 * 60 * 1000);
    return new TimeoutManager(timeout, (info) => new DevOpsAPITimeoutError(info.url, timeout));
  }

  private async _awaitStatus(id: string, req: DevOpsAPIRequestInfo, info: LongRunningRequestInfo, timeoutManager: TimeoutManager, started: number): Promise<void> {
    if (info.options?.blocking === false) {
      return;
    }

    const pollInterval = info.options?.pollInterval || info.defaultPollInterval;
    let waiting = false;

    for (;;) {
      if (waiting) {
        continue;
      }
      waiting = true;

      this.logger.adminCommandPolling?.(req, started, pollInterval);

      const resp = await this.request({
        method: HttpMethods.Get,
        path: `/databases/${id}`,
      }, {
        timeoutManager: timeoutManager,
      }, started);

      if (resp.data?.status === info.target) {
        break;
      }

      if (!info.legalStates.includes(resp.data?.status)) {
        const okStates = [info.target, ...info.legalStates];
        const error = new DevOpsUnexpectedStateError(`Created database is not in any legal state [${okStates.join(',')}]`, okStates, resp.data);

        this.logger.adminCommandFailed?.(req, true, error, started);
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

const mkAuthHeaderProvider = (tp: TokenProvider): HeaderProvider => () => {
  const token = tp.getToken();

  return (token instanceof Promise)
    ? token.then(mkAuthHeader)
    : mkAuthHeader(token);
};

const mkAuthHeader = (token: string | nullish): Record<string, string> => (token)
  ? { [DEFAULT_DEVOPS_API_AUTH_HEADER]: `Bearer ${token}` }
  : {};
