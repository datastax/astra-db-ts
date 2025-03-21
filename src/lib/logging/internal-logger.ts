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

import type { DataAPIClientEventMap, LoggingOutput } from '@/src/lib/logging/types.js';
import type {
  CommandFailedEvent,
  CommandStartedEvent,
  CommandSucceededEvent,
  CommandWarningsEvent,
} from '@/src/documents/index.js';
import type {
  AdminCommandFailedEvent,
  AdminCommandPollingEvent,
  AdminCommandStartedEvent,
  AdminCommandSucceededEvent,
  AdminCommandWarningsEvent,
} from '@/src/administration/index.js';
import { EmptyInternalLoggingConfig, EventConstructors, PrintLoggingOutputs } from '@/src/lib/logging/constants.js';
import { buildOutputsMap } from '@/src/lib/logging/util.js';
import type { BaseClientEvent } from '@/src/lib/index.js';
import { PropagationState } from '@/src/lib/index.js';
import type { ParsedLoggingConfig } from '@/src/lib/logging/cfg-handler.js';
import { LoggingCfgHandler } from '@/src/lib/logging/cfg-handler.js';
import * as uuid from 'uuid';

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
export type InternalLoggingOutputsMap = Readonly<Record<keyof DataAPIClientEventMap, Readonly<Record<LoggingOutput, boolean>> | undefined>>

/**
 * @internal
 */
export class InternalLogger<Events extends Record<string, BaseClientEvent>> implements Partial<Record<keyof DataAPIClientEventMap, unknown>> {
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

  private _someCommandEventEnabled = false;
  private _someAdminCommandEventEnabled = false;

  private _config: InternalLoggingOutputsMap;
  private readonly _listeners: Partial<Record<keyof Events, ((event: any) => void)[]>> = {};
  private readonly _parent: InternalLogger<Events> | undefined;
  private readonly _console: ConsoleLike;

  constructor(config: ParsedLoggingConfig, parent: InternalLogger<Events> | undefined, console: ConsoleLike) {
    this._parent = parent;
    this._console = console;
    this._config = this._buildInternalConfig(config);
  }

  public generateCommandRequestId() {
    return this._someCommandEventEnabled ? uuid.v4() : '';
  }

  public generateAdminCommandRequestId() {
    return this._someAdminCommandEventEnabled ? uuid.v4() : '';
  }

  public updateLoggingConfig(config: ParsedLoggingConfig) {
    this._config = this._updateInternalConfig(this._config, config);
  }

  public on<E extends keyof Events>(eventName: E, listener: (event: Events[E]) => void) {
    if (!this._listeners[eventName]) {
      this._listeners[eventName] = [];
    }

    this._listeners[eventName].push(listener);
  }

  public off<E extends keyof Events>(eventName: E, listener: (event: Events[E]) => void) {
    if (!this._listeners[eventName]) {
      return;
    }

    const index = this._listeners[eventName].indexOf(listener);

    if (index !== -1) {
      this._listeners[eventName].splice(index, 1);
    }

    if (this._listeners[eventName].length === 0) {
      delete this._listeners[eventName];
    }
  }
  
  public removeAllListeners<E extends keyof Events>(eventName?: E) {
    if (eventName) {
      delete this._listeners[eventName];
    } else {
      for (const key in this._listeners) {
        delete this._listeners[key];
      }
    }
  }

  public emit<E extends keyof Events>(eventName: E, event: Events[E]) {
    if (this._listeners[eventName]) {
      for (const listener of this._listeners[eventName]) {
        try {
          listener(event);
        } catch (_e) {
          // Silently ignore errors
        }

        if (event._propagationState === PropagationState.StopImmediate) {
          return;
        }
      }
    }

    if (this._parent && event._propagationState !== PropagationState.Stop) {
      this._parent.emit(eventName, event);
    }
  }
  
  private _buildInternalConfig(config: ParsedLoggingConfig): InternalLoggingOutputsMap {
    return this._updateInternalConfig(EmptyInternalLoggingConfig, config);
  }

  private _updateInternalConfig(base: InternalLoggingOutputsMap, config: ParsedLoggingConfig): InternalLoggingOutputsMap {
    const newConfig = { ...base };

    for (const layer of config.layers) {
      for (const event of layer.events) {
        newConfig[event] = buildOutputsMap(layer.emits);

        const activeOutputs = PrintLoggingOutputs.filter(key => newConfig[event]?.[key]);

        if (activeOutputs.length > 1) {
          throw new Error(`Nonsensical logging configuration; conflicting outputs '${activeOutputs}' set for '${event}'`);
        }
      }
    }

    this._buildLoggingFunctions(newConfig);
    return newConfig;
  }

  private _buildLoggingFunctions(config: InternalLoggingOutputsMap) {
    this._someCommandEventEnabled = false;
    this._someAdminCommandEventEnabled = false;

    for (const [_eventName, outputs] of Object.entries(config)) {
      const eventName = _eventName as keyof DataAPIClientEventMap;

      if (!outputs) {
        this[eventName] = undefined;
        continue;
      }

      const log = this._mkLogFn(outputs);

      if (eventName.startsWith('admin')) {
        this._someAdminCommandEventEnabled = true;
      } else {
        this._someCommandEventEnabled = true;
      }

      this[eventName] = (...args: any[]) => {
        const event = new (<any>EventConstructors[eventName])(...args);
        outputs.event && this.emit(eventName, event);
        log?.(event);
      };
    }
  }

  private _mkLogFn(outputs: Readonly<Record<LoggingOutput, boolean>>) {
    switch (true) {
      case outputs.stdout:
        return (event: BaseClientEvent) => this._console.log(event.format());
      case outputs.stderr:
        return (event: BaseClientEvent) => this._console.error(event.format());
      case outputs['stdout:verbose']:
        return (event: BaseClientEvent) => this._console.log(event.formatVerbose());
      case outputs['stderr:verbose']:
        return (event: BaseClientEvent) => this._console.error(event.formatVerbose());
    }
  }
}
