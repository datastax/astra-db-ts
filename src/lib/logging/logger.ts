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

import type { DataAPIClientEventMap } from '@/src/lib/logging/types';
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
import type { DataAPIClientEvent, ParsedLoggingConfig } from '@/src/lib';
import { InternalLoggingOutputsMap } from '@/src/client/types/internal';
import { LoggingCfgHandler } from '@/src/lib/logging/cfg-handler';

interface ConsoleLike {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

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
        const eventClass = new (<any>EventConstructors[event])(...args) as DataAPIClientEvent;

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

  // public static parseConfig = parseLoggingConfig;

  // public static advanceConfig(config?: ParsedLoggingConfig, newConfig?: DataAPILoggingConfig): ParsedLoggingConfig | undefined {
  //   if (!config && !newConfig) {
  //     return undefined;
  //   }
  //   if (!config) {
  //     return Logger.normalizeLoggingConfig(newConfig);
  //   }
  //   return [...config, ...Logger.normalizeLoggingConfig(newConfig)];
  // }

  // public static normalizeLoggingConfig(config: DataAPILoggingConfig | undefined): ParsedLoggingConfig {
  //   if (!config) {
  //     return [];
  //   }
  //
  //   if (config === 'all') {
  //     return DataAPILoggingDefaults;
  //   }
  //
  //   if (typeof config === 'string') {
  //     return [{ events: [config], emits: DataAPILoggingDefaultOutputs[config] }];
  //   }
  //
  //   return config.flatMap((c, i) => {
  //     if (c === 'all') {
  //       return DataAPILoggingDefaults;
  //     }
  //
  //     if (typeof c === 'string') {
  //       return [{ events: [c], emits: DataAPILoggingDefaultOutputs[c] }];
  //     }
  //
  //     if (c.events === 'all' || Array.isArray(c.events) && c.events.includes('all')) {
  //       if (c.events === 'all' || c.events.length === 1 && c.events[0] === 'all') {
  //         return [{ events: LoggingEventsWithoutAll, emits: Array.isArray(c.emits) ? c.emits : [c.emits] }];
  //       }
  //       throw new Error(`Nonsensical logging configuration; can not have 'all' in a multi-element array (@ idx ${i})`);
  //     }
  //
  //     return [{
  //       events: Array.isArray(c.events) ? c.events : [c.events],
  //       emits: Array.isArray(c.emits) ? c.emits : [c.emits],
  //     }];
  //   });
  // };

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
