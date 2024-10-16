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
import {
  DataAPIClientEvents,
  DataAPILoggingConfig,
  DataAPILoggingEvent,
  DataAPILoggingOutput,
} from '@/src/client/types';
import { LoggingEvents } from '@/src/client/parsers/logging';
import EventEmitter = NodeJS.EventEmitter;

const LoggingEventsWithoutAll = LoggingEvents.filter(e => e !== 'all');

export abstract class DataAPIClientEvent {
  public abstract formatted(): string;
}

export type InternalLogger = Record<keyof DataAPIClientEvents, (e: DataAPIClientEvent) => void>;

export const mkLogger = (cfg: InternalLoggingConfig, emitter: EventEmitter) =>
  Object.fromEntries(Object.entries(cfg).map(([event, outputs]) => [event, (e: DataAPIClientEvent) => {
    if (outputs?.event) {
      emitter.emit(event, e);
    }

    if (outputs?.stdout) {
      console.log(e.formatted());
    } else if (outputs?.stderr) {
      console.error(e.formatted());
    }
  }])) as InternalLogger;

export const evalLoggingConfig = (base: InternalLoggingConfig, config: DataAPILoggingConfig | undefined): InternalLoggingConfig => {
  const asExplicit = normalizeLoggingConfig(config);
  const newConfig = structuredClone(base);

  for (const layer of asExplicit) {
    for (const event of (layer.events as (keyof DataAPIClientEvents)[])) {
      newConfig[event] = buildOutputsMap(layer.emits);

      if (newConfig[event]?.stdout && newConfig[event].stderr) {
        throw new Error(`Nonsensical logging configuration; attempted to set both stdout and stderr outputs for '${event}'`);
      }
    }
  }

  return newConfig;
};

const buildOutputsMap = (emits: readonly DataAPILoggingOutput[]) => (emits.length === 0)
  ? undefined
  : ({
    event: emits.includes('event'),
    stdout: emits.includes('stdout'),
    stderr: emits.includes('stderr'),
  });

interface StrictDataAPIExplicitLoggingConfig {
  events: readonly DataAPILoggingEvent[],
  emits: readonly DataAPILoggingOutput[],
}

const normalizeLoggingConfig = (config: DataAPILoggingConfig | undefined): StrictDataAPIExplicitLoggingConfig[] => {
  if (!config) {
    return [];
  }

  if (config === 'all') {
    return EventLoggingDefaultsAll;
  }

  if (typeof config === 'string') {
    return [{ events: [config], emits: EventLoggingDefaults[config] }];
  }

  return config.flatMap((c, i) => {
    if (c === 'all') {
      return EventLoggingDefaultsAll;
    }

    if (typeof c === 'string') {
      return [{ events: [c], emits: EventLoggingDefaults[c] }];
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

export const EmptyInternalLoggingConfig = Object.fromEntries(LoggingEventsWithoutAll.map((e) => [e, buildOutputsMap([])])) as InternalLoggingConfig;

export const EventLoggingDefaults = <const>{
  adminCommandStarted: ['event', 'stdout'],
  adminCommandPolling: ['event', 'stdout'],
  adminCommandSucceeded: ['event', 'stdout'],
  adminCommandFailed: ['event', 'stderr'],
  adminCommandWarning: ['event', 'stderr'],
  commandStarted: ['event'],
  commandFailed: ['event', 'stderr'],
  commandSucceeded: ['event'],
  commandWarning: ['event', 'stderr'],
};

export const EventLoggingDefaultsAll: StrictDataAPIExplicitLoggingConfig[] = [{
  events: ['adminCommandStarted', 'adminCommandPolling', 'adminCommandSucceeded'],
  emits: ['event', 'stdout'],
}, {
  events: ['adminCommandFailed', 'commandFailed', 'commandWarning', 'adminCommandWarning'],
  emits: ['event', 'stderr'],
}, {
  events: ['commandStarted', 'commandSucceeded'],
  emits: ['event'],
}];
