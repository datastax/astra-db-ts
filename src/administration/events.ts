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

import { DevOpsAPIRequestInfo } from '@/src/lib/api/clients/devops-api-http-client';
import { DataAPIErrorDescriptor } from '@/src/documents';
import { DataAPIClientEvent } from '@/src/lib/logging/events';

/**
 * The events emitted by the {@link DataAPIClient}. These events are emitted at various stages of the
 * admin command's lifecycle. Intended for use for monitoring and logging purposes.
 *
 * @public
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
  adminCommandWarnings: (event: AdminCommandWarningsEvent) => void,
}

/**
 * Common base class for all admin command events.
 *
 * @public
 */
export abstract class AdminCommandEvent extends DataAPIClientEvent {
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

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  protected constructor(info: DevOpsAPIRequestInfo, longRunning: boolean) {
    super();
    this.path = info.path;
    this.method = info.method;
    this.reqBody = info.data;
    this.params = info.params;
    this.longRunning = longRunning;
  }

  formatted(): string {
    return JSON.stringify(this);
  }
}

/**
 * Event emitted when an admin command is started. This is emitted before the initial HTTP request is made.
 *
 * See {@link AdminCommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export class AdminCommandStartedEvent extends AdminCommandEvent {
  /**
   * The timeout for the request, in milliseconds.
   */
  public readonly timeout: number;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(info: DevOpsAPIRequestInfo, longRunning: boolean, timeout: number) {
    super(info, longRunning);
    this.timeout = timeout;
  }

  formatted(): string {
    return JSON.stringify(this);
  }
}

/**
 * Event emitted when a command is polling in a long-running operation (i.e. create database).
 *
 * Emits every time the command polls.
 *
 * See {@link AdminCommandEvent} for more information about all the common properties available on this event.
 *
 * @public
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

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(info: DevOpsAPIRequestInfo, started: number, interval: number) {
    super(info, true);
    this.elapsed = performance.now() - started;
    this.interval = interval;
  }

  formatted(): string {
    return JSON.stringify(this);
  }
}

/**
 * Event emitted when an admin command has succeeded, after any necessary polling.
 *
 * See {@link AdminCommandEvent} for more information about all the common properties available on this event.
 *
 * @public
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

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(info: DevOpsAPIRequestInfo, longRunning: boolean, data: Record<string, any> | undefined, started: number) {
    super(info, longRunning);
    this.duration = performance.now() - started;
    this.resBody = data || undefined;
  }

  formatted(): string {
    return JSON.stringify(this);
  }
}

/**
 * Event emitted when an admin command has errored.
 *
 * See {@link AdminCommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export class AdminCommandFailedEvent extends AdminCommandEvent {
  /**
   * The duration of the command, in milliseconds.
   */
  public readonly duration: number;

  /**
   * The error that occurred.
   *
   * Typically, some {@link DevOpsAPIError}, commonly a {@link DevOpsAPIResponseError} or sometimes a
   * {@link DevOpsUnexpectedStateError}
   */
  public readonly error: Error;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(info: DevOpsAPIRequestInfo, longRunning: boolean, error: Error, started: number) {
    super(info, longRunning);
    this.duration = performance.now() - started;
    this.error = error;
  }

  formatted(): string {
    return JSON.stringify(this);
  }
}

export class AdminCommandWarningsEvent extends AdminCommandEvent {
  public readonly warnings: DataAPIErrorDescriptor[];

  constructor(info: DevOpsAPIRequestInfo, longRunning: boolean, warnings: DataAPIErrorDescriptor[]) {
    super(info, longRunning);
    this.warnings = warnings;
  }

  formatted(): string {
    return JSON.stringify(this);
  }
}
