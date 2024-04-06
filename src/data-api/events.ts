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

import { DataAPIRequestInfo, DEFAULT_NAMESPACE, hrTimeMs, RawDataAPIResponse } from '@/src/api';

/**
 * The events emitted by the {@link DataAPIClient}. These events are emitted at various stages of the
 * command's lifecycle. Intended for use for monitoring and logging purposes.
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
 */
export abstract class CommandEvent {
  /**
   * The command object. Equal to the response body of the HTTP request.
   */
  public readonly command: Record<string, any>;
  /**
   * The namespace the command is being run in.
   */
  public readonly namespace: string;
  /**
   * The collection the command is being run on, if applicable.
   */
  public readonly collection?: string;
  /**
   * The command name.
   */
  public readonly commandName: string;
  /**
   * The URL the command is being sent to.
   */
  public readonly url: string;

  protected constructor(info: DataAPIRequestInfo) {
    this.command = info.command;
    this.namespace = info.namespace || DEFAULT_NAMESPACE;
    this.collection = info.collection;
    this.commandName = Object.keys(info.command)[0];
    this.url = info.url;
  }
}

/**
 * Emitted when a command is started, before the initial HTTP request is made.
 */
export class CommandStartedEvent extends CommandEvent {
  /**
   * The timeout for the command, in milliseconds.
   */
  public readonly timeout: number;

  constructor(info: DataAPIRequestInfo) {
    super(info);
    this.timeout = info.timeoutManager.ms;
  }
}

/**
 * Emitted when a command has succeeded.
 */
export class CommandSucceededEvent extends CommandEvent {
  /**
   * The duration of the command, in milliseconds.
   */
  public readonly duration: number;
  /**
   * The response object from the Data API.
   */
  public readonly resp?: RawDataAPIResponse;

  constructor(info: DataAPIRequestInfo, reply: RawDataAPIResponse, started: number) {
    super(info);
    this.duration = hrTimeMs() - started;
    this.resp = reply;
  }
}

/**
 * Emitted when a command has errored.
 */
export class CommandFailedEvent extends CommandEvent {
  /**
   * The duration of the command, in milliseconds.
   */
  public readonly duration: number;
  /**
   * The error that caused the command to fail.
   */
  public readonly error: Error;

  constructor(info: DataAPIRequestInfo, error: Error, started: number) {
    super(info);
    this.duration = hrTimeMs() - started;
    this.error = error;
  }
}
