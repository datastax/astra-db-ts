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

import { DevOpsAPIRequestInfo, hrTimeMs } from '@/src/api';
import { AxiosResponse } from 'axios';

/**
 * The events emitted by the {@link DataAPIClient}. These events are emitted at various stages of the
 * admin command's lifecycle. Intended for use for monitoring and logging purposes.
 */
export type AdminCommandEvents = {
  /**
   * Emitted when an admin command is started, before the initial HTTP request is made.
   */
  adminCommandStarted: (event: AdminCommandStartedEvent) => void,
  /**
   * Emitted when a command is polling in a long-running operation (i.e. create database).
   */
  adminCommandPolling: (event: AdminCommandPollingEvent) => void,
  /**
   * Emitted when an admin command has succeeded, after any necessary polling.
   */
  adminCommandSucceeded: (event: AdminCommandSucceededEvent) => void,
  /**
   * Emitted when an admin command has errored.
   */
  adminCommandFailed: (event: AdminCommandFailedEvent) => void,
}

/**
 * Common base class for all admin command events.
 */
export abstract class AdminCommandEvent {
  /**
   * The path for the request, not including the Base URL.
   */
  public readonly path: string;
  /**
   * The HTTP method for the request.
   */
  public readonly method: 'GET' | 'POST' | 'DELETE';
  /**
   * The request body, if any.
   */
  public readonly reqBody?: Record<string, any>;
  /**
   * The query parameters, if any.
   */
  public readonly params?: Record<string, any>;
  /**
   * Whether the command is long-running or not, i.e. requires polling.
   */
  public readonly longRunning: boolean;

  protected constructor(info: DevOpsAPIRequestInfo, longRunning: boolean) {
    this.path = info.path;
    this.method = info.method;
    this.reqBody = info.data;
    this.params = info.params;
    this.longRunning = longRunning;
  }
}

/**
 * Event emitted when an admin command is started. This is emitted before the initial HTTP request is made.
 */
export class AdminCommandStartedEvent extends AdminCommandEvent {
  /**
   * The timeout for the request, in milliseconds.
   */
  public readonly timeout: number;

  constructor(info: DevOpsAPIRequestInfo, longRunning: boolean, timeout: number) {
    super(info, longRunning);
    this.timeout = timeout;
  }
}

/**
 * Event emitted when a command is polling in a long-running operation (i.e. create database).
 *
 * Emits every time the command polls.
 */
export class AdminCommandPollingEvent extends AdminCommandEvent {
  /**
   * The elapsed time since the command was started, in milliseconds.
   */
  public readonly elapsed: number;
  /**
   * The polling interval, in milliseconds.
   */
  public readonly interval: number;

  constructor(info: DevOpsAPIRequestInfo, started: number, interval: number) {
    super(info, true);
    this.elapsed = hrTimeMs() - started;
    this.interval = interval;
  }
}

/**
 * Event emitted when an admin command has succeeded, after any necessary polling.
 */
export class AdminCommandSucceededEvent extends AdminCommandEvent {
  /**
   * The duration of the command, in milliseconds.
   */
  public readonly duration: number;
  /**
   * The response body of the command, if any.
   */
  public readonly resBody?: Record<string, any>;

  constructor(info: DevOpsAPIRequestInfo, longRunning: boolean, resp: AxiosResponse, started: number) {
    super(info, longRunning);
    this.duration = hrTimeMs() - started;
    this.resBody = resp.data || undefined;
  }
}

/**
 * Event emitted when an admin command has errored.
 */
export class AdminCommandFailedEvent extends AdminCommandEvent {
  /**
   * The duration of the command, in milliseconds.
   */
  public readonly duration: number;
  /**
   * The error that occurred.
   */
  public readonly error: Error;

  constructor(info: DevOpsAPIRequestInfo, longRunning: boolean, error: Error, started: number) {
    super(info, longRunning);
    this.duration = hrTimeMs() - started;
    this.error = error;
  }
}
