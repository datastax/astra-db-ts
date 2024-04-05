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

import { hrTimeMs, HttpClient } from '@/src/api/http-client';
import { AxiosError, AxiosResponse } from 'axios';
import { HTTPClientOptions, HttpMethodStrings } from '@/src/api/types';
import { HTTP1AuthHeaderFactories, HTTP1Strategy } from '@/src/api/http1';
import { DevopsApiResponseError, DevopsApiTimeout, DevopsUnexpectedStateError } from '@/src/devops/errors';
import { AdminBlockingOptions } from '@/src/devops/types';
import { MkTimeoutError, TimeoutManager, TimeoutOptions } from '@/src/api/timeout-managers';
import { HttpMethods } from '@/src/api/constants';
import {
  AdminCommandFailedEvent,
  AdminCommandPollingEvent,
  AdminCommandStartedEvent,
  AdminCommandSucceededEvent,
} from '@/src/devops';

/**
 * @internal
 */
export interface DevopsApiRequestInfo {
  path: string,
  method: HttpMethodStrings,
  data?: Record<string, any>,
  params?: Record<string, any>,
}

/**
 * @internal
 */
export interface LongRunningRequestInfo {
  id: string | ((resp: AxiosResponse) => string),
  target: string,
  legalStates: string[],
  defaultPollInterval: number,
  options: AdminBlockingOptions | undefined,
}

/**
 * @internal
 */
export class DevopsApiHttpClient extends HttpClient {
  constructor(props: HTTPClientOptions) {
    super(props);
    this.requestStrategy = new HTTP1Strategy(HTTP1AuthHeaderFactories.DevopsApi);
  }

  public async request(req: DevopsApiRequestInfo, options: TimeoutOptions | undefined, started: number = 0): Promise<AxiosResponse> {
    const isLongRunning = started !== 0;

    try {
      const timeoutManager = options?.timeoutManager ?? mkTimeoutManager(options?.maxTimeMS);
      const url = this.baseUrl + req.path;

      if (this.monitorCommands && !isLongRunning) {
        this.emitter.emit('adminCommandStarted', new AdminCommandStartedEvent(req, isLongRunning, timeoutManager.ms));
      }

      started ||= hrTimeMs();

      const resp = await this._request({
        url: url,
        method: req.method,
        params: req.params,
        data: req.data,
        timeoutManager,
      }) as AxiosResponse;

      if (this.monitorCommands && !isLongRunning) {
        this.emitter.emit('adminCommandSucceeded', new AdminCommandSucceededEvent(req, false, resp, started));
      }

      return resp;
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }

      if (this.monitorCommands) {
        this.emitter.emit('adminCommandFailed', new AdminCommandFailedEvent(req, isLongRunning, e, started));
      }

      if (!(e instanceof AxiosError)) {
        throw e;
      }
      throw new DevopsApiResponseError(e);
    }
  }

  public async requestLongRunning(req: DevopsApiRequestInfo, info: LongRunningRequestInfo): Promise<AxiosResponse> {
    const timeoutManager = mkTimeoutManager(info.options?.maxTimeMS);
    const isLongRunning = info?.options?.blocking !== false;

    if (this.monitorCommands) {
      this.emitter.emit('adminCommandStarted', new AdminCommandStartedEvent(req, isLongRunning, timeoutManager.ms));
    }

    const started = hrTimeMs();
    const resp = await this.request(req, { timeoutManager }, started);

    const id = (typeof info.id === 'function')
      ? info.id(resp)
      : info.id;

    await this._awaitStatus(id, req, info, timeoutManager, started);

    if (this.monitorCommands && isLongRunning) {
      this.emitter.emit('adminCommandSucceeded', new AdminCommandSucceededEvent(req, true, resp, started));
    }

    return resp;
  }

  private async _awaitStatus(id: string, req: DevopsApiRequestInfo, info: LongRunningRequestInfo, timeoutManager: TimeoutManager, started: number): Promise<void> {
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

      if (this.monitorCommands) {
        this.emitter.emit('adminCommandPolling', new AdminCommandPollingEvent(req, started, pollInterval));
      }

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
        const error = new DevopsUnexpectedStateError(`Created database is not in any legal state [${[info.target, ...info.legalStates].join(',')}]`, resp);

        if (this.monitorCommands) {
          this.emitter.emit('adminCommandFailed', new AdminCommandFailedEvent(req, true, error, started));
        }

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

const mkTimeoutManager = (maxMs: number | undefined) => {
  const timeout = maxMs ?? 0;
  return new TimeoutManager(timeout, mkTimeoutErrorMaker(timeout));
}

const mkTimeoutErrorMaker = (timeout: number): MkTimeoutError => {
  return (info) => new DevopsApiTimeout(info.url, timeout);
}
