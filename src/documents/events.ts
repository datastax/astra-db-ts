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

import { DEFAULT_KEYSPACE, type RawDataAPIResponse } from '@/src/lib/index.js';
// import { DataAPIClientEvent } from '@/src/lib/logging/events'; needs to be like this or it errors
import { BaseClientEvent } from '@/src/lib/logging/base-event.js';
import type { DataAPIRequestInfo } from '@/src/lib/api/clients/data-api-http-client.js';
import type { DataAPIErrorDescriptor } from '@/src/documents/errors.js';
import type { TimeoutDescriptor } from '@/src/lib/api/timeouts/timeouts.js';

/**
 * The events emitted by the {@link DataAPIClient}. These events are emitted at various stages of the
 * command's lifecycle. Intended for use for monitoring and logging purposes.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "insertMany" or "updateMany",
 * which may be split into multiple of those commands under the hood.**
 *
 * @public
 */
// eslint-disable-next-line -- is type instead of an interface to prevent issues w/ it not extending EventMap
export type CommandEventMap = {
  /**
   * Emitted when a command is started, before the initial HTTP request is made.
   */
  commandStarted: CommandStartedEvent,
  /**
   * Emitted when a command has succeeded.
   */
  commandSucceeded: CommandSucceededEvent,
  /**
   * Emitted when a command has errored.
   */
  commandFailed: CommandFailedEvent,
  /**
   * Emitted when a command has warnings.
   */
  commandWarnings: CommandWarningsEvent,
}

/**
 * Common base class for all command events.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "insertMany" or "updateMany",
 * which may be split into multiple of those commands under the hood.**
 *
 * @public
 */
export abstract class CommandEvent extends BaseClientEvent {
  /**
   * The command object. Equal to the response body of the HTTP request.
   *
   * Note that this is the actual raw command object; it's not necessarily 1:1 with methods called on the collection/db.
   *
   * @example
   * ```typescript
   * {
   *   insertOne: { document: { name: 'John' } }
   * }
   * ```
   */
  public readonly command: Record<string, any>;

  /**
   * The keyspace the command is being run in.
   */
  public readonly keyspace: string;

  /**
   * The table/collection the command is being run on, if applicable.
   */
  public readonly source?: string;

  /**
   * The command name.
   *
   * This is the key of the command object. For example, if the command object is
   * `{ insertOne: { document: { name: 'John' } } }`, the command name is `insertOne`.
   */
  public readonly commandName: string;

  /**
   * The URL the command is being sent to.
   */
  public readonly url: string;

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  protected constructor(name: string, info: DataAPIRequestInfo) {
    super(name);
    this.command = info.command;
    this.keyspace = info.keyspace || DEFAULT_KEYSPACE;
    this.source = info.collection;
    this.commandName = Object.keys(info.command)[0];
    this.url = info.url;
  }

  /**
   * @internal
   */
  protected _desc() {
    return `(${this.keyspace}${this.source ? `.${this.source}` : ''}) ${this.commandName}`;
  }
}

/**
 * Emitted when a command is started, before the initial HTTP request is made.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "insertMany" or "updateMany",
 * which may be split into multiple of those commands under the hood.**
 *
 * See {@link CommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export class CommandStartedEvent extends CommandEvent {
  /**
   * The timeout for the command, in milliseconds.
   */
  public readonly timeout: Partial<TimeoutDescriptor>;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(info: DataAPIRequestInfo) {
    super('CommandStarted', info);
    this.timeout = info.timeoutManager.initial();
  }

  /**
   * Formats the warnings into a human-readable string.
   */
  public format(): string {
    // return `${super.formatted()}: ${this.commandName} in ${this.keyspace}${this.source ? `.${this.source}` : ''}`;
    return `${super.format()}: ${this._desc()}`;
  }
}

/**
 * Emitted when a command has succeeded.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "insertMany" or "updateMany",
 * which may be split into multiple of those commands under the hood.**
 *
 * See {@link CommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export class CommandSucceededEvent extends CommandEvent {
  /**
   * The duration of the command, in milliseconds. Starts counting from the moment of the initial HTTP request.
   */
  public readonly duration: number;

  /**
   * The response object from the Data API.
   */
  public readonly resp: RawDataAPIResponse;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(info: DataAPIRequestInfo, reply: RawDataAPIResponse, started: number) {
    super('CommandSucceeded', info);
    this.duration = performance.now() - started;
    this.resp = reply;
  }

  /**
   * Formats the warnings into a human-readable string.
   */
  public format(): string {
    return `${super.format()}: ${this._desc()} (took ${~~this.duration}ms)`;
  }
}

/**
 * Emitted when a command has errored.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "insertMany" or "updateMany",
 * which may be split into multiple of those commands under the hood.**
 *
 * See {@link CommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export class CommandFailedEvent extends CommandEvent {
  /**
   * The duration of the command, in milliseconds.
   */
  public readonly duration: number;

  /**
   * The error that caused the command to fail.
   *
   * Typically, some {@link DataAPIError}, commonly a {@link DataAPIResponseError} or one of its subclasses.
   */
  public readonly error: Error;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(info: DataAPIRequestInfo, error: Error, started: number) {
    super('CommandFailed', info);
    this.duration = performance.now() - started;
    this.error = error;
  }

  /**
   * Formats the warnings into a human-readable string.
   */
  public format(): string {
    return `${super.format()}: ${this._desc()} (took ${~~this.duration}ms) - '${this.error.message}'`;
  }
}

/**
 * Event emitted when the Data API returned a warning for some command.
 *
 * See {@link CommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export class CommandWarningsEvent extends CommandEvent {
  /**
   * The warnings that occurred.
   */
  public readonly warnings: DataAPIErrorDescriptor[];

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(info: DataAPIRequestInfo, warnings: DataAPIErrorDescriptor[]) {
    super('CommandWarnings', info);
    this.warnings = warnings;
  }

  /**
   * Formats the warnings into a human-readable string.
   */
  public format(): string {
    return `${super.format()}: ${this._desc()} '${this.warnings.map(w => w.message).join(', ')}'`;
  }
}
