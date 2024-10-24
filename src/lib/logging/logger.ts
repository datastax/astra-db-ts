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

import { InternalLoggingConfig } from '@/src/client/types/internal';
import { DataAPIClientEvents, DataAPILoggingConfig, NormalizedLoggingConfig } from '@/src/lib/logging/types';
import { CommandFailedEvent, CommandStartedEvent, CommandSucceededEvent, CommandWarningsEvent } from '@/src/documents';
import type {
  AdminCommandFailedEvent,
  AdminCommandPollingEvent,
  AdminCommandStartedEvent,
  AdminCommandSucceededEvent,
  AdminCommandWarningsEvent,
} from '@/src/administration';
import {
  EmptyInternalLoggingConfig,
  EventConstructors,
  EventLoggingDefaults,
  EventLoggingOutputDefaults,
  LoggingEventsWithoutAll,
} from '@/src/lib/logging/constants';
import { buildOutputsMap } from '@/src/lib/logging/util';
import TypedEventEmitter from 'typed-emitter';
import { parseLoggingConfig } from '@/src/lib/logging/parser';
import { DataAPIClientEvent } from '@/src/lib/logging/events';

interface ConsoleLike {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

export class Logger implements Partial<Record<keyof DataAPIClientEvents, unknown>> {
  public commandStarted?:        (...args: ConstructorParameters<typeof CommandStartedEvent>       ) => void;
  public commandFailed?:         (...args: ConstructorParameters<typeof CommandFailedEvent>        ) => void;
  public commandWarnings?:       (...args: ConstructorParameters<typeof CommandWarningsEvent>      ) => void;
  public commandSucceeded?:      (...args: ConstructorParameters<typeof CommandSucceededEvent>     ) => void;
  public adminCommandFailed?:    (...args: ConstructorParameters<typeof AdminCommandFailedEvent>   ) => void;
  public adminCommandStarted?:   (...args: ConstructorParameters<typeof AdminCommandStartedEvent>  ) => void;
  public adminCommandPolling?:   (...args: ConstructorParameters<typeof AdminCommandPollingEvent>  ) => void;
  public adminCommandWarnings?:  (...args: ConstructorParameters<typeof AdminCommandWarningsEvent> ) => void;
  public adminCommandSucceeded?: (...args: ConstructorParameters<typeof AdminCommandSucceededEvent>) => void;

  constructor(_config: NormalizedLoggingConfig[] | undefined, private emitter: TypedEventEmitter<DataAPIClientEvents>, private console: ConsoleLike) {
    const config = Logger.buildInternalConfig(_config);

    for (const [_event, outputs] of Object.entries(config)) if (outputs) {
      const event = _event as keyof DataAPIClientEvents;

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

  public static advanceConfig(config?: NormalizedLoggingConfig[], newConfig?: DataAPILoggingConfig): NormalizedLoggingConfig[] | undefined {
    if (!config && !newConfig) {
      return undefined;
    }
    if (!config) {
      return Logger.normalizeLoggingConfig(newConfig);
    }
    return [...config, ...Logger.normalizeLoggingConfig(newConfig)];
  }

  private static normalizeLoggingConfig(config: DataAPILoggingConfig | undefined): NormalizedLoggingConfig[] {
    if (!config) {
      return [];
    }

    if (config === 'all') {
      return EventLoggingDefaults;
    }

    if (typeof config === 'string') {
      return [{ events: [config], emits: EventLoggingOutputDefaults[config] }];
    }

    return config.flatMap((c, i) => {
      if (c === 'all') {
        return EventLoggingDefaults;
      }

      if (typeof c === 'string') {
        return [{ events: [c], emits: EventLoggingOutputDefaults[c] }];
      }

      if (c.events === 'all' || Array.isArray(c.events) && c.events.includes('all')) {
        if (c.events === 'all' || c.events.length === 1 && c.events[0] === 'all') {
          return [{ events: LoggingEventsWithoutAll, emits: Array.isArray(c.emits) ? c.emits : [c.emits] }];
        }
        throw new Error(`Nonsensical logging configuration; can not have 'all' in a multi-element array (@ idx ${i})`);
      }

      return [{
        events: Array.isArray(c.events) ? c.events : [c.events],
        emits: Array.isArray(c.emits) ? c.emits : [c.emits],
      }];
    });
  };

  private static buildInternalConfig(config: NormalizedLoggingConfig[] | undefined): InternalLoggingConfig {
    const newConfig = { ...EmptyInternalLoggingConfig };

    for (const layer of config ?? []) {
      for (const event of (layer.events as (keyof DataAPIClientEvents)[])) {
        newConfig[event] = buildOutputsMap(layer.emits);

        if (newConfig[event]?.stdout && newConfig[event].stderr) {
          throw new Error(`Nonsensical logging configuration; attempted to set both stdout and stderr outputs for '${event}'`);
        }
      }
    }

    return newConfig;
  }

  public static parseConfig(config: DataAPILoggingConfig | undefined, field: string): DataAPILoggingConfig | undefined {
    return parseLoggingConfig(config, field);
  }
}
