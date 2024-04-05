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

import { DataApiRequestInfo, DEFAULT_NAMESPACE, hrTimeMs, RawDataApiResponse } from '@/src/api';

export type DataApiCommandEvents = {
  commandStarted: (event: CommandStartedEvent) => void,
  commandSucceeded: (event: CommandSucceededEvent) => void,
  commandFailed: (event: CommandFailedEvent) => void,
}

export abstract class CommandEvent {
  public readonly command: Record<string, any>;
  public readonly namespace: string;
  public readonly collection?: string;
  public readonly commandName: string;
  public readonly url: string;

  protected constructor(info: DataApiRequestInfo) {
    this.command = info.command;
    this.namespace = info.namespace || DEFAULT_NAMESPACE;
    this.collection = info.collection;
    this.commandName = Object.keys(info.command)[0];
    this.url = info.url;
  }
}

export class CommandStartedEvent extends CommandEvent {
  public readonly timeout: number;

  constructor(info: DataApiRequestInfo) {
    super(info);
    this.timeout = info.timeoutManager.ms;
  }
}

export class CommandSucceededEvent extends CommandEvent {
  public readonly duration: number;
  public readonly resp?: RawDataApiResponse;

  constructor(info: DataApiRequestInfo, reply: RawDataApiResponse, started: number) {
    super(info);
    this.duration = hrTimeMs() - started;
    this.resp = reply;
  }
}

export class CommandFailedEvent extends CommandEvent {
  public readonly duration: number;
  public readonly error: Error;

  constructor(info: DataApiRequestInfo, error: Error, started: number) {
    super(info);
    this.duration = hrTimeMs() - started;
    this.error = error;
  }
}
