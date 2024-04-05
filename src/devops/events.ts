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

import { DevopsApiRequestInfo, hrTimeMs } from '@/src/api';
import { AxiosResponse } from 'axios';

export type AdminCommandEvents = {
  adminCommandStarted: (event: AdminCommandStartedEvent) => void,
  adminCommandPolling: (event: AdminCommandPollingEvent) => void,
  adminCommandSucceeded: (event: AdminCommandSucceededEvent) => void,
  adminCommandFailed: (event: AdminCommandFailedEvent) => void,
}

export abstract class AdminCommandEvent {
  public readonly path: string;
  public readonly method: string;
  public readonly reqBody?: Record<string, any>;
  public readonly params?: Record<string, any>;
  public readonly longRunning: boolean;

  protected constructor(info: DevopsApiRequestInfo, longRunning: boolean) {
    this.path = info.path;
    this.method = info.method;
    this.reqBody = info.data;
    this.params = info.params;
    this.longRunning = longRunning;
  }
}

export class AdminCommandStartedEvent extends AdminCommandEvent {
  public readonly timeout: number;

  constructor(info: DevopsApiRequestInfo, longRunning: boolean, timeout: number) {
    super(info, longRunning);
    this.timeout = timeout;
  }
}

export class AdminCommandPollingEvent extends AdminCommandEvent {
  public readonly elapsed: number;
  public readonly interval: number;

  constructor(info: DevopsApiRequestInfo, started: number, interval: number) {
    super(info, true);
    this.elapsed = hrTimeMs() - started;
    this.interval = interval;
  }
}

export class AdminCommandSucceededEvent extends AdminCommandEvent {
  public readonly duration: number;
  public readonly resBody?: Record<string, any>;

  constructor(info: DevopsApiRequestInfo, longRunning: boolean, resp: AxiosResponse, started: number) {
    super(info, longRunning);
    this.duration = hrTimeMs() - started;
    this.resBody = resp.data;
  }
}

export class AdminCommandFailedEvent extends AdminCommandEvent {
  public readonly duration: number;
  public readonly error: Error;

  constructor(info: DevopsApiRequestInfo, longRunning: boolean, error: Error, started: number) {
    super(info, longRunning);
    this.duration = hrTimeMs() - started;
    this.error = error;
  }
}
