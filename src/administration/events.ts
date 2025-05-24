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
// import { DataAPIClientEvent } from '@/src/lib/logging/events'; needs to be like this or it errors

import type { DevOpsAPIRequestMetadata } from '@/src/lib/api/clients/impls/devops-api-http-client.js';
import type { DataAPIWarningDescriptor } from '@/src/documents/index.js';
import { BaseClientEvent } from '@/src/lib/logging/base-event.js';
import type { TimeoutDescriptor } from '@/src/lib/api/timeouts/timeouts.js';
import type { NonEmpty, ReadonlyNonEmpty } from '@/src/lib/index.js';

/**
 * The events emitted by the {@link DataAPIClient}. These events are emitted at various stages of the
 * admin command's lifecycle. Intended for use for monitoring and logging purposes.
 *
 * @public
 */
// eslint-disable-next-line -- is type instead of an interface to prevent issues w/ it not extending EventMap
export type AdminCommandEventMap = {
  /**
   * Emitted when an admin command is started, before the initial HTTP request is made.
   */
  adminCommandStarted: AdminCommandStartedEvent,
  /**
   * Emitted when a command is polling in a long-running operation (i.e. create database).
   */
  adminCommandPolling: AdminCommandPollingEvent,
  /**
   * Emitted when an admin command has succeeded, after any necessary polling.
   */
  adminCommandSucceeded: AdminCommandSucceededEvent,
  /**
   * Emitted when an admin command has errored.
   */
  adminCommandFailed: AdminCommandFailedEvent,
  /**
   * Emitted when an admin command has warnings.
   */
  adminCommandWarnings: AdminCommandWarningsEvent,
}

/**
 * Common base class for all admin command events.
 *
 * @public
 */
export abstract class AdminCommandEvent extends BaseClientEvent {
  /**
   * The path for the request, not including the Base URL.
   */
  public readonly url: string;

  /**
   * The HTTP method for the request.
   */
  public readonly requestMethod: 'GET' | 'POST' | 'DELETE';

  /**
   * The request body, if any.
   */
  public readonly requestBody?: Record<string, any>;

  /**
   * The query parameters, if any.
   */
  public readonly requestParams?: Record<string, any>;

  /**
   * Whether the command is long-running or not, i.e. requires polling.
   */
  public readonly isLongRunning: boolean;

  /**
   * The method which invoked the request
   */
  public readonly invokingMethod: string;

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  protected constructor(name: string, metadata: DevOpsAPIRequestMetadata) {
    super(name, metadata.requestId, undefined);
    this.url = metadata.baseUrl + metadata.reqOpts.path;
    this.requestMethod = metadata.reqOpts.method;
    this.requestBody = metadata.reqOpts.data;
    this.requestParams = metadata.reqOpts.params;
    this.isLongRunning = metadata.isLongRunning;
    this.invokingMethod = metadata.reqOpts.methodName;
  }

  public override getMessagePrefix() {
    return `(${this.invokingMethod}) ${this.requestMethod} ${this.url}${this.requestParams ? '?' : ''}${new URLSearchParams(this.requestParams).toString()}`;
  }

  /**
   * @internal
   */
  protected override _modifyEventForFormatVerbose() {}
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
   * Poor man's sealed class. See {@link BaseClientEvent._permits} for more info.
   * 
   * @internal
   */
  protected declare _permits: this;

  /**
   * The timeout for the request, in milliseconds.
   */
  public readonly timeout: Partial<TimeoutDescriptor>;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(metadata: DevOpsAPIRequestMetadata) {
    super('AdminCommandStarted', metadata);
    this.timeout = metadata.timeout;
  }

  public override getMessage(): string {
    return `${this.isLongRunning ? '(blocking) ' : ''}${this.requestBody ? `${JSON.stringify(this.requestBody)}` : ''}`;
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
   * Poor man's sealed class. See {@link BaseClientEvent._permits} for more info.
   * 
   * @internal
   */
  protected declare _permits: this;

  /**
   * The elapsed time since the command was started, in milliseconds.
   */
  public readonly elapsed: number;

  /**
   * The polling interval, in milliseconds.
   */
  public readonly pollInterval: number;

  /**
   * The number of times polled so far
   */
  public readonly pollCount: number;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(metadata: DevOpsAPIRequestMetadata, interval: number, pollCount: number) {
    super('AdminCommandPolling', metadata);
    this.elapsed = performance.now() - metadata.startTime;
    this.pollInterval = interval;
    this.pollCount = pollCount;
  }

  public override getMessage(): string {
    return `(poll #${this.pollCount}; ${~~this.elapsed}ms elapsed)`;
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
   * Poor man's sealed class. See {@link BaseClientEvent._permits} for more info.
   * 
   * @internal
   */
  protected declare _permits: this;

  /**
   * The duration of the command, in milliseconds.
   */
  public readonly duration: number;

  /**
   * The response body of the command, if any.
   */
  public readonly responseBody?: Record<string, any>;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(metadata: DevOpsAPIRequestMetadata, data: Record<string, any> | undefined) {
    super('AdminCommandSucceeded', metadata);
    this.duration = performance.now() - metadata.startTime;
    this.responseBody = data || undefined;
  }

  public override getMessage(): string {
    return `${this.requestBody ? `${JSON.stringify(this.requestBody)} ` : ''}(${~~this.duration}ms)`;
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
   * Poor man's sealed class. See {@link BaseClientEvent._permits} for more info.
   * 
   * @internal
   */
  protected declare _permits: this;

  /**
   * The duration of the command, in milliseconds.
   */
  public readonly duration: number;

  /**
   * The error that occurred.
   *
   * Typically, some {@link DevOpsAPIError}, commonly a {@link DevOpsAPIResponseError} or sometimes a
   * {@link DevOpsAPITimeoutError}
   */
  public readonly error: Error;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(metadata: DevOpsAPIRequestMetadata, error: Error) {
    super('AdminCommandFailed', metadata);
    this.duration = performance.now() - metadata.startTime;
    this.error = error;
  }

  public override getMessage(): string {
    return `${this.requestBody ? `${JSON.stringify(this.requestBody)} ` : ''}(${~~this.duration}ms) ERROR: ${JSON.stringify(this.error.message)}`;
  }
}

/**
 * Event emitted when the Data API returned a warning for an admin command.
 *
 * See {@link AdminCommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export class AdminCommandWarningsEvent extends AdminCommandEvent {
  /**
   * Poor man's sealed class. See {@link BaseClientEvent._permits} for more info.
   * 
   * @internal
   */
  protected declare _permits: this;

  /**
   * The warnings that occurred.
   */
  public readonly warnings: ReadonlyNonEmpty<DataAPIWarningDescriptor>;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(metadata: DevOpsAPIRequestMetadata, warnings: NonEmpty<DataAPIWarningDescriptor>) {
    super('AdminCommandWarnings', metadata);
    this.warnings = warnings;
  }

  public override getMessage(): string {
    return `${this.requestBody ? `${JSON.stringify(this.requestBody)} ` : ''}WARNINGS: ${this.warnings.map(w => JSON.stringify(w.message)).join(', ')}`;
  }
}
