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

import type { MonoidType, OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handler.js';
import { MonoidalOptionsHandler, monoids } from '@/src/lib/opts-handler.js';
import type { LoggingConfig, LoggingEvent, LoggingOutput, OneOrMany } from '@/src/lib/index.js';
import { array, either, exact, instanceOf, nonEmptyArray, nullish, oneOf } from 'decoders';
import {
  LoggingDefaultOutputs,
  LoggingDefaults,
  LoggingEvents,
  LoggingEventsWithoutAll,
  LoggingOutputs,
} from '@/src/lib/logging/constants.js';
import { oneOrMany, toArray } from '@/src/lib/utils.js';

/**
 * @internal
 */
interface Types extends OptionsHandlerTypes {
  Parsed: ParsedLoggingConfig,
  Parseable: LoggingConfig | undefined | null,
}

/**
 * @internal
 */
const monoid = monoids.object({
  layers: monoids.array<{
    events: readonly Exclude<LoggingEvent, 'all' | RegExp>[],
    emits: readonly LoggingOutput[],
  }>(),
});

/**
 * @internal
 */
export type ParsedLoggingConfig = MonoidType<typeof monoid> & Parsed<'LoggingConfig'>;

/**
 * @internal
 */
const oneOfLoggingEvents = either(oneOf(LoggingEvents), instanceOf(RegExp)).describe('one of LoggingEvent (including "all"), or a regex which matches such');

/**
 * @internal
 */
const oneOfLoggingEventsWithoutAll = either(oneOf(LoggingEventsWithoutAll), instanceOf(RegExp)).describe('one of LoggingEvent (excluding "all"), or a regex which matches such');

/**
 * @internal
 */
const decoder = nullish(either(
  oneOfLoggingEvents,
  array(either(
    oneOfLoggingEvents,
    exact({
      events: either(oneOfLoggingEvents, nonEmptyArray(oneOfLoggingEventsWithoutAll)),
      emits: oneOrMany(oneOf(LoggingOutputs)),
    }),
  )),
));

/**
 * @internal
 */
const transformer = decoder.transform((config) => {
  if (!config) {
    return monoid.empty;
  }

  if (config === 'all') {
    return { layers: LoggingDefaults };
  }

  if (typeof config === 'string') {
    return { layers: [{ events: [config], emits: LoggingDefaultOutputs[config] }] };
  }

  if (config instanceof RegExp) {
    config = regex2events(config);
  }

  const layers = config.flatMap((c) => {
    if (c === 'all') {
      return LoggingDefaults;
    }

    if (typeof c === 'string') {
      return [{ events: [c], emits: LoggingDefaultOutputs[c] }];
    }

    if (c instanceof RegExp) {
      return regex2events(c).map((e) => ({ events: [e], emits: LoggingDefaultOutputs[e] }));
    }

    return [{
      events: buildEvents(c.events),
      emits: Array.isArray(c.emits) ? c.emits : [c.emits],
    }];
  });

  return { layers };
});

/**
 * @internal
 */
export const LoggingCfgHandler = new MonoidalOptionsHandler<Types>(transformer, monoid);

function regex2events(regex: RegExp): typeof LoggingEventsWithoutAll {
  return LoggingEventsWithoutAll.filter((e) => regex.test(e));
}

function buildEvents(events: OneOrMany<LoggingEvent>): readonly Exclude<LoggingEvent, 'all' | RegExp>[] {
  return toArray(events).flatMap((e) => {
    if (e === 'all') {
      return LoggingEventsWithoutAll;
    }

    if (e instanceof RegExp) {
      return LoggingEventsWithoutAll.filter((ee) => e.test(ee));
    }

    return e;
  });
}
