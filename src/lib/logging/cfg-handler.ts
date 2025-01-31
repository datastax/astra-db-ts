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

import { MonoidalOptionsHandler, OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handler';
import { DataAPILoggingConfig, DataAPILoggingEvent, DataAPILoggingOutput } from '@/src/lib';
import { array, DecoderType, either, nonEmptyArray, object, oneOf, optional } from 'decoders';
import {
  LoggingDefaultOutputs,
  LoggingDefaults,
  LoggingEvents,
  LoggingEventsWithoutAll,
  LoggingOutputs,
} from '@/src/lib/logging/constants';
import { oneOrMany } from '@/src/lib/utils';

/**
 * @internal
 */
export interface ParsedLoggingConfig extends Parsed<'DataAPILoggingConfig'> {
  layers: {
    events: readonly Exclude<DataAPILoggingEvent, 'all'>[],
    emits: readonly DataAPILoggingOutput[],
  }[],
}

/**
 * @internal
 */
interface LoggingConfigTypes extends OptionsHandlerTypes {
  Parsed: ParsedLoggingConfig,
  Parseable: DataAPILoggingConfig | undefined,
  Decoded: DecoderType<typeof loggingConfig>,
}

const oneOfLoggingEvents = oneOf(LoggingEvents).describe('one of DataAPILoggingEvent (including "all")');
const oneOfLoggingEventsWithoutAll = oneOf(LoggingEventsWithoutAll).describe('one of DataAPILoggingEvent (excluding "all")');

const loggingConfig = optional(either(
  oneOfLoggingEvents,
  array(either(
    oneOfLoggingEvents,
    object({
      events: either(oneOfLoggingEvents, nonEmptyArray(oneOfLoggingEventsWithoutAll)),
      emits: oneOrMany(oneOf(LoggingOutputs)),
    }),
  )),
));

/**
 * @internal
 */
export const LoggingCfgHandler = new MonoidalOptionsHandler<LoggingConfigTypes>({
  decoder: loggingConfig,
  refine(config) {
    if (!config) {
      return this.empty;
    }

    if (config === 'all') {
      return { layers: LoggingDefaults };
    }

    if (typeof config === 'string') {
      return { layers: [{ events: [config], emits: LoggingDefaultOutputs[config] }] };
    }

    const layers = config.flatMap((c) => {
      if (c === 'all') {
        return LoggingDefaults;
      }

      if (typeof c === 'string') {
        return [{ events: [c], emits: LoggingDefaultOutputs[c] }];
      }

      if (c.events === 'all') {
        return [{ events: LoggingEventsWithoutAll, emits: Array.isArray(c.emits) ? c.emits : [c.emits] }];
      }

      return [{
        events: Array.isArray(c.events) ? c.events : [c.events],
        emits: Array.isArray(c.emits) ? c.emits : [c.emits],
      }];
    });

    return { layers };
  },
  concat(configs) {
    return { layers: configs.flatMap(c => c.layers) };
  },
  empty: { layers: [] },
});
