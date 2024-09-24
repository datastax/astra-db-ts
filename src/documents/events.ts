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

import { DEFAULT_KEYSPACE, RawDataAPIResponse } from '@/src/lib/api';
import { DataAPIRequestInfo } from '@/src/lib/api/clients/data-api-http-client';
import { hrTimeMs } from '@/src/lib/api/clients/http-client';

/**
 * The events emitted by the {@link DataAPIClient}. These events are emitted at various stages of the
 * command's lifecycle. Intended for use for monitoring and logging purposes.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "bulkWrite", "insertMany", or "deleteAll",
 * which have to be translated into appropriate Data API commands.**
 *
 * @public
 */
export type DataAPICommandEvents = {
  /**
   * Emitted when a command is started, before the initial HTTP request is made.
   */
  commandStarted: (event: CommandStartedEvent) => void,
  /**
   * Emitted when a command has succeeded.
   */
  commandSucceeded: (event: CommandSucceededEvent) => void,
  /**
   * Emitted when a command has errored.
   */
  commandFailed: (event: CommandFailedEvent) => void,
}

/**
 * Common base class for all command events.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "bulkWrite", "insertMany", or "deleteAll",
 * which have to be translated into appropriate Data API commands.**
 *
 * @public
 */
export abstract class CommandEvent {
  /**
   * The command object. Equal to the response body of the HTTP request.
   *
   * Note that this is the actual raw command object; it's not necessarily 1:1 with methods called on the collection/db.
   *
   * For example, a `deleteAll` method on a collection will be translated into a `deleteMany` command, and a `bulkWrite`
   * method will be translated into a series of `insertOne`, `updateOne`, etc. commands.
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
   * The keyspace the command is being run in.
   *
   * This is now a deprecated alias for the strictly equivalent {@link CommandEvent.keyspace}, and will be removed
   * in an upcoming major version.
   *
   * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
   *
   * @deprecated - Prefer {@link CommandEvent.keyspace} instead.
   */
  public readonly namespace: string;

  /**
   * The collection the command is being run on, if applicable.
   */
  public readonly collection?: string;

  /**
   * The command name.
   *
   * This is the key of the command object. For example, if the command object is
   * `{ insertOne: { document: { name: 'John' } } }`, the command name is `insertOne`.
   *
   * Meaning, abstracted commands like `bulkWrite`, or `deleteAll` will be shown as their actual command equivalents.
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
  protected constructor(info: DataAPIRequestInfo) {
    this.command = info.command;
    this.keyspace = this.namespace = info.keyspace || DEFAULT_KEYSPACE;
    this.collection = info.collection;
    this.commandName = Object.keys(info.command)[0];
    this.url = info.url;
  }
}

/**
 * Emitted when a command is started, before the initial HTTP request is made.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "bulkWrite", "insertMany", or "deleteAll",
 * which have to be translated into appropriate Data API commands.**
 *
 * See {@link CommandEvent} for more information about all the common properties available on this event.
 *
 * @public
 */
export class CommandStartedEvent extends CommandEvent {
  /**
   * The timeout for the command, in milliseconds.
   */
  public readonly timeout: number;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(info: DataAPIRequestInfo) {
    super(info);
    this.timeout = info.timeoutManager.ms;
  }
}

/**
 * Emitted when a command has succeeded.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "bulkWrite", "insertMany", or "deleteAll",
 * which have to be translated into appropriate Data API commands.**
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
  public readonly resp?: RawDataAPIResponse;

  /**
   * Any warnings returned from the Data API that may point out deprecated/incorrect practices,
   * or any other issues that aren't strictly an error.
   */
  public readonly warnings: string[];

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  constructor(info: DataAPIRequestInfo, reply: RawDataAPIResponse, warnings: string[], started: number) {
    super(info);
    this.duration = hrTimeMs() - started;
    this.warnings = warnings;
    this.resp = reply;
  }
}

/**
 * Emitted when a command has errored.
 *
 * **Note that these emit *real* commands, not any abstracted commands like "bulkWrite", "insertMany", or "deleteAll",
 * which have to be translated into appropriate Data API commands.**
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
    super(info);
    this.duration = hrTimeMs() - started;
    this.error = error;
  }
}
