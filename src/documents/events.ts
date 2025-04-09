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

import type { NonEmpty, ReadonlyNonEmpty } from '@/src/lib/index.js';
import { type RawDataAPIResponse } from '@/src/lib/index.js';
import { BaseClientEvent } from '@/src/lib/logging/base-event.js';
import type { DataAPIRequestInfo } from '@/src/lib/api/clients/data-api-http-client.js';
import type { DataAPIWarningDescriptor } from '@/src/documents/errors.js';
import { DataAPIError } from '@/src/documents/errors.js';
import type { TimeoutDescriptor } from '@/src/lib/api/timeouts/timeouts.js';
import type { SomeDoc } from '@/src/documents/collections/index.js';

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

// export type CommandEventTarget = { url: string } & (
//   | { keyspace: string } & ({ table: string, collection?: never } | { collection: string, table?: never })
//   | { keyspace?: never, table?: never, collection?: never }
// )

/**
 * The target of the command.
 *
 * @public
 */
export type CommandEventTarget =
  | { url: string, keyspace?: never, table?: never, collection?: never }
  | { url: string, keyspace: string, table?: never, collection?: never }
  | { url: string, keyspace: string, table?: never, collection: string }
  | { url: string, keyspace: string, table: string, collection?: never }

const mkCommandEventTarget = (info: DataAPIRequestInfo): Readonly<CommandEventTarget> => {
  const target = { url: info.url } as CommandEventTarget;

  if (info.keyspace) {
    target.keyspace = info.keyspace;
  }

  if (info.tOrCType) {
    target[info.tOrCType] = info.tOrC;
  }

  return target;
};

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
   * The target of the command.
   */
  public readonly target: Readonly<CommandEventTarget>;

  /**
   * Should not be instantiated directly.
   *
   * @internal
   */
  protected constructor(name: string, requestId: string, info: DataAPIRequestInfo, extra: Record<string, unknown> | undefined) {
    super(name, requestId, extra);
    this.command = info.command;
    this.target = mkCommandEventTarget(info);
  }

  /**
   * The command name.
   *
   * This is the key of the command object. For example, if the command object is
   * `{ insertOne: { document: { name: 'John' } } }`, the command name is `insertOne`.
   */
  public get commandName(): string {
    return Object.keys(this.command)[0];
  }

  public override getMessagePrefix() {
    const source = this.target.collection || this.target.table;

    return (source === undefined)
      ? `${this.target.keyspace ?? '<no_keyspace>'}::${this.commandName}`
      : `${source}::${this.commandName}`;
  }

  /**
   * @internal
   */
  protected _extraLogInfoAsString() {
    return this.extraLogInfo ? `{${Object.entries(this.extraLogInfo).map(([k, v]) => `${k}=${v}`).join(',')}} ` : '';
  }

  /**
   * @internal
   */
  protected override _modifyEventForFormatVerbose(event: SomeDoc) {
    event.target = event.target.url;
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
   * Poor man's sealed class. See {@link BaseClientEvent._permits} for more info.
   *
   * @internal
   */
  protected declare _permits: this;

  /**
   * The timeout for the command, in milliseconds.
   */
  public readonly timeout: Partial<TimeoutDescriptor>;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(requestId: string, info: DataAPIRequestInfo, extra: Record<string, unknown> | undefined) {
    super('CommandStarted', requestId, info, extra);
    this.timeout = info.timeoutManager.initial();
  }

  public override getMessage(): string {
    return this._extraLogInfoAsString();
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
   * Poor man's sealed class. See {@link BaseClientEvent._permits} for more info.
   *
   * @internal
   */
  protected declare _permits: this;

  /**
   * The duration of the command, in milliseconds. Starts counting from the moment of the initial HTTP request.
   */
  public readonly duration: number;

  /**
   * The response object from the Data API.
   */
  public readonly response: RawDataAPIResponse;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(requestId: string, info: DataAPIRequestInfo, extra: Record<string, unknown> | undefined, reply: RawDataAPIResponse, started: number) {
    super('CommandSucceeded', requestId, info, extra);
    this.duration = performance.now() - started;
    this.response = reply;
  }

  public override getMessage(): string {
    return `${this._extraLogInfoAsString()}(${~~this.duration}ms)`;
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
   * The error that caused the command to fail.
   *
   * Typically, some {@link DataAPIError}, commonly a {@link DataAPIResponseError} or one of its subclasses.
   */
  public readonly error: Error;

  /**
   * The response object from the Data API, if available.
   */
  public readonly response?: RawDataAPIResponse;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(requestId: string, info: DataAPIRequestInfo, extra: Record<string, unknown> | undefined, reply: RawDataAPIResponse | undefined, error: Error, started: number) {
    super('CommandFailed', requestId, info, extra);
    this.duration = performance.now() - started;
    this.response = reply;
    this.error = error;
  }

  public override getMessage(): string {
    return `${this._extraLogInfoAsString()}(${~~this.duration}ms) ERROR: ${JSON.stringify(this.error.message)}`;
  }

  public override trimDuplicateFields(): this {
    if (this.error instanceof DataAPIError) {
      return { ...this, error: this.error.withTransientDupesForEvents() };
    }
    return this;
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
  constructor(requestId: string, info: DataAPIRequestInfo, extra: Record<string, unknown> | undefined, warnings: NonEmpty<DataAPIWarningDescriptor>) {
    super('CommandWarnings', requestId, info, extra);
    this.warnings = warnings;
  }

  public override getMessage(): string {
    return `${this._extraLogInfoAsString()}WARNINGS: ${this.warnings.map(w => JSON.stringify(w.message)).join(', ')}`;
  }
}
