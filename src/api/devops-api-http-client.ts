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

import { HttpClient } from '@/src/api/http-client';
import { HTTP_METHODS } from '@/src/api/constants';
import { AxiosError, AxiosResponse } from 'axios';
import { HTTPClientOptions } from '@/src/api/types';
import { HTTP1AuthHeaderFactories, HTTP1Strategy } from '@/src/api/http1';
import { DevopsApiResponseError, DevopsApiTimeout, DevopsUnexpectedStateError } from '@/src/devops/errors';
import { AdminBlockingOptions, PollBlockingOptions } from '@/src/devops/types';
import {
  MkTimeoutError,
  MultiCallTimeoutManager,
  SingleCallTimeoutManager,
  TimeoutManager,
  TimeoutOptions,
} from '@/src/api/timeout-managers';

interface DevopsApiRequestInfo {
  path: string,
  method: HTTP_METHODS,
  data?: Record<string, any>,
  params?: Record<string, any>,
}

interface LongRunningRequestInfo {
  id: string | ((resp: AxiosResponse) => string),
  target: string,
  legalStates: string[],
  defaultPollInterval: number,
  options: AdminBlockingOptions | undefined,
}

export class DevopsApiHttpClient extends HttpClient {
  constructor(props: HTTPClientOptions) {
    super(props);
    this.requestStrategy = new HTTP1Strategy(HTTP1AuthHeaderFactories.DevopsApi);
  }

  public async request(info: DevopsApiRequestInfo, options: TimeoutOptions | undefined): Promise<AxiosResponse> {
    try {
      const timeoutManager = options?.timeoutManager ?? mkTimeoutManager(SingleCallTimeoutManager, options?.maxTimeMS);
      const url = this.baseUrl + info.path;

      return await this._request({
        url: url,
        method: info.method,
        params: info.params,
        data: info.data,
        timeoutManager,
      }) as any;
    } catch (e) {
      if (!(e instanceof AxiosError)) {
        throw e;
      }
      throw new DevopsApiResponseError(e);
    }
  }

  public async requestLongRunning(req: DevopsApiRequestInfo, info: LongRunningRequestInfo): Promise<AxiosResponse> {
    const timeoutManager = mkTimeoutManager(MultiCallTimeoutManager, info.options?.maxTimeMS);
    const resp = await this.request(req, { timeoutManager });

    const id = (typeof info.id === 'function')
      ? info.id(resp)
      : info.id;

    if (info?.options?.blocking !== false) {
      await this._awaitStatus(id, info.target, info.legalStates, info.options, info.defaultPollInterval, timeoutManager);
    }

    return resp;
  }

  private async _awaitStatus(id: string, target: string, legalStates: string[], options: PollBlockingOptions | undefined, defaultPollInterval: number, timeoutManager: TimeoutManager): Promise<void> {
    for (;;) {
      const resp = await this.request({
        method: HTTP_METHODS.Get,
        path: `/databases/${id}`,
      }, {
        timeoutManager: timeoutManager,
      });

      if (resp.data?.status === target) {
        break;
      }

      if (!legalStates.includes(resp.data?.status)) {
        throw new DevopsUnexpectedStateError(`Created database is not in any legal state [${[target, ...legalStates].join(',')}]`, resp)
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, options?.pollInterval || defaultPollInterval);
      });
    }
  }
}

const mkTimeoutManager = (constructor: new (maxMs: number, mkTimeoutError: MkTimeoutError) => TimeoutManager, maxMs: number | undefined) => {
  const timeout = maxMs ?? 0;
  return new constructor(timeout, mkTimeoutErrorMaker(timeout));
}

const mkTimeoutErrorMaker = (timeout: number): MkTimeoutError => {
  return (info) => new DevopsApiTimeout(info.url, timeout);
}
