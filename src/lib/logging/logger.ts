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
// noinspection DuplicatedCode

import { DataAPIClientEventMap, DataAPILoggingOutput } from '@/src/lib/logging/types';
import type {
  CommandFailedEvent,
  CommandStartedEvent,
  CommandSucceededEvent,
  CommandWarningsEvent,
} from '@/src/documents';
import type {
  AdminCommandFailedEvent,
  AdminCommandPollingEvent,
  AdminCommandStartedEvent,
  AdminCommandSucceededEvent,
  AdminCommandWarningsEvent,
} from '@/src/administration';
import { EmptyInternalLoggingConfig, EventConstructors } from '@/src/lib/logging/constants';
import { buildOutputsMap } from '@/src/lib/logging/util';
import type TypedEventEmitter from 'typed-emitter';
import type { BaseDataAPIClientEvent } from '@/src/lib';
import { LoggingCfgHandler, ParsedLoggingConfig } from '@/src/lib/logging/cfg-handler';

/**
 * @internal
 */
interface ConsoleLike {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

/**
 * @internal
 */
export type InternalLoggingOutputsMap = Readonly<Record<keyof DataAPIClientEventMap, Readonly<Record<DataAPILoggingOutput, boolean>> | undefined>>

/**
 * @internal
 */
export class Logger implements Partial<Record<keyof DataAPIClientEventMap, unknown>> {
  public commandStarted?:        (...args: ConstructorParameters<typeof CommandStartedEvent>       ) => void;
  public commandFailed?:         (...args: ConstructorParameters<typeof CommandFailedEvent>        ) => void;
  public commandWarnings?:       (...args: ConstructorParameters<typeof CommandWarningsEvent>      ) => void;
  public commandSucceeded?:      (...args: ConstructorParameters<typeof CommandSucceededEvent>     ) => void;
  public adminCommandFailed?:    (...args: ConstructorParameters<typeof AdminCommandFailedEvent>   ) => void;
  public adminCommandStarted?:   (...args: ConstructorParameters<typeof AdminCommandStartedEvent>  ) => void;
  public adminCommandPolling?:   (...args: ConstructorParameters<typeof AdminCommandPollingEvent>  ) => void;
  public adminCommandWarnings?:  (...args: ConstructorParameters<typeof AdminCommandWarningsEvent> ) => void;
  public adminCommandSucceeded?: (...args: ConstructorParameters<typeof AdminCommandSucceededEvent>) => void;

  public static cfg: typeof LoggingCfgHandler = LoggingCfgHandler;

  constructor(_config: ParsedLoggingConfig, private emitter: TypedEventEmitter<DataAPIClientEventMap>, private console: ConsoleLike) {
    const config = Logger.buildInternalConfig(_config);

    for (const [_event, outputs] of Object.entries(config)) if (outputs) {
      const event = _event as keyof DataAPIClientEventMap;

      this[event] = (...args: any[]) => {
        const eventClass = new (<any>EventConstructors[event])(...args) as BaseDataAPIClientEvent;

        if (outputs.event) {
          this.emitter.emit(event, <any>eventClass);
        }

        if (outputs.stdout) {
          this.console.log(eventClass.formatted());
        } else if (outputs.stderr) {
          this.console.error(eventClass.formatted());
        }
      };
    }
  }

  private static buildInternalConfig(config: ParsedLoggingConfig): InternalLoggingOutputsMap {
    const newConfig = { ...EmptyInternalLoggingConfig };

    for (const layer of config.layers) {
      for (const event of layer.events) {
        newConfig[event] = buildOutputsMap(layer.emits);

        if (newConfig[event]?.stdout && newConfig[event].stderr) {
          throw new Error(`Nonsensical logging configuration; attempted to set both stdout and stderr outputs for '${event}'`);
        }
      }
    }

    return newConfig;
  }
}
