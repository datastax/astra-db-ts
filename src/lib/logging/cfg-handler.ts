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

import { DecoderType, OptionsHandler, OptionsHandlerOpts } from '@/src/lib/opts-handler';
import { DataAPILoggingConfig, DataAPILoggingEvent, DataAPILoggingOutput } from '@/src/lib';
import { array, either, nonEmptyArray, object, oneOf, optional } from 'decoders';
import {
  DataAPILoggingDefaultOutputs,
  DataAPILoggingDefaults,
  LoggingEvents,
  LoggingEventsWithoutAll,
  LoggingOutputs,
} from '@/src/lib/logging/constants';
import { oneOrMany } from '@/src/lib/utils';

export interface InternalLoggingConfig {
  events: readonly Exclude<DataAPILoggingEvent, 'all'>[],
  emits: readonly DataAPILoggingOutput[],
}

/**
 * @internal
 */
interface LoggingConfigTypes extends OptionsHandlerOpts {
  Transformed: InternalLoggingConfig[],
  Parseable: DataAPILoggingConfig | undefined,
  Parsed: DecoderType<typeof loggingConfig>,
}

const loggingConfig = optional(either(
  oneOf(LoggingEvents),
  array(either(
    oneOf(LoggingEvents),
    object({
      events: either(oneOf(LoggingEvents), nonEmptyArray(oneOf(LoggingEventsWithoutAll))),
      emits: oneOrMany(oneOf(LoggingOutputs)),
    }),
  )),
));

/**
 * @internal
 */
export const LoggingCfgHandler = new OptionsHandler<LoggingConfigTypes>({
  decoder: loggingConfig,
  transform(config) {
    if (!config) {
      return [];
    }

    if (config === 'all') {
      return DataAPILoggingDefaults;
    }

    if (typeof config === 'string') {
      return [{ events: [config], emits: DataAPILoggingDefaultOutputs[config] }];
    }

    return config.flatMap((c) => {
      if (c === 'all') {
        return DataAPILoggingDefaults;
      }

      if (typeof c === 'string') {
        return [{ events: [c], emits: DataAPILoggingDefaultOutputs[c] }];
      }

      if (c.events === 'all') {
        return [{ events: LoggingEventsWithoutAll, emits: Array.isArray(c.emits) ? c.emits : [c.emits] }];
      }

      return [{
        events: Array.isArray(c.events) ? c.events : [c.events],
        emits: Array.isArray(c.emits) ? c.emits : [c.emits],
      }];
    });
  },
  concat(configs): InternalLoggingConfig[] {
    return configs.flat();
  },
  empty: [],
});
