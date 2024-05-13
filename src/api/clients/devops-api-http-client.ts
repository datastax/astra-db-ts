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

import { hrTimeMs, HttpClient } from '@/src/api/clients/http-client';
import { DevOpsAPIResponseError, DevOpsAPITimeoutError, DevOpsUnexpectedStateError } from '@/src/devops/errors';
import { AdminBlockingOptions } from '@/src/devops/types';
import { TimeoutManager, TimeoutOptions } from '@/src/api/timeout-managers';
import { DEFAULT_DEVOPS_API_AUTH_HEADER, HttpMethods } from '@/src/api/constants';
import {
  AdminCommandFailedEvent,
  AdminCommandPollingEvent,
  AdminCommandStartedEvent,
  AdminCommandSucceededEvent,
} from '@/src/devops';
import { HTTPClientOptions, HttpMethodStrings } from '@/src/api/clients/types';

/**
 * @internal
 */
export interface DevOpsAPIRequestInfo {
  path: string,
  method: HttpMethodStrings,
  data?: Record<string, any>,
  params?: Record<string, any>,
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

/**
 * @internal
 */
export class DevOpsAPIHttpClient extends HttpClient {
  constructor(opts: HTTPClientOptions) {
    super(opts, mkHeaders);
  }

  public async request(req: DevOpsAPIRequestInfo, options: TimeoutOptions | undefined, started: number = 0): Promise<DevopsAPIResponse> {
    const isLongRunning = started !== 0;

    try {
      const timeoutManager = options?.timeoutManager ?? this._mkTimeoutManager(options?.maxTimeMS);
      const url = this.baseUrl + req.path;

      if (this.monitorCommands && !isLongRunning) {
        this.emitter.emit('adminCommandStarted', new AdminCommandStartedEvent(req, isLongRunning, timeoutManager.ms));
      }

      started ||= hrTimeMs();

      const resp = await this._request({
        url: url,
        method: req.method,
        params: req.params,
        data: JSON.stringify(req.data),
        forceHttp1: true,
        timeoutManager,
      });

      const data = resp.body ? JSON.parse(resp.body) : undefined;

      if (resp.status >= 400) {
        throw new DevOpsAPIResponseError(resp, data);
      }

      if (this.monitorCommands && !isLongRunning) {
        this.emitter.emit('adminCommandSucceeded', new AdminCommandSucceededEvent(req, false, data, started));
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

      if (this.monitorCommands) {
        this.emitter.emit('adminCommandFailed', new AdminCommandFailedEvent(req, isLongRunning, e, started));
      }

      throw e;
    }
  }

  public async requestLongRunning(req: DevOpsAPIRequestInfo, info: LongRunningRequestInfo): Promise<DevopsAPIResponse> {
    const timeoutManager = this._mkTimeoutManager(info.options?.maxTimeMS);
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
        const okStates = [info.target, ...info.legalStates];
        const error = new DevOpsUnexpectedStateError(`Created database is not in any legal state [${okStates.join(',')}]`, okStates, resp.data);

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

  private _mkTimeoutManager(timeout: number | undefined) {
    timeout ??= this.fetchCtx.maxTimeMS ?? (12 * 60 * 1000);
    return new TimeoutManager(timeout, (url) => new DevOpsAPITimeoutError(url, timeout));
  }
}

function mkHeaders(token: string) {
  return { [DEFAULT_DEVOPS_API_AUTH_HEADER]: `Bearer ${token}` };
}
