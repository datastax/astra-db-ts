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

import { r, EqualityProof, isNonEmpty, ok, p, Result } from '@/src/lib/validation';
import { isNullish } from '@/src/lib/utils';
import { SomeDoc } from '@/src/documents';
import {
  DataAPIExplicitLoggingConfig,
  DataAPILoggingConfig,
  DataAPILoggingEvent,
  DataAPILoggingOutput,
} from '@/src/client/types/logging';

export const parseLoggingConfig = (config: unknown, field: string): Result<DataAPILoggingConfig | undefined> => {
  if (isNullish(config)) {
    return ok(undefined);
  }

  if (typeof config === 'string') {
    return parseLoggingEvent(config, `${field}`);
  }

  if (!Array.isArray(config)) {
    return p.typeError(`Expected ${field} to be of type string | (string | object[]); got ${typeof config}`);
  }

  if (!isNonEmpty(config)) {
    return p.error(`Expected ${field} array to be non-empty`);
  }

  return r.mapM((c, i): Result<DataAPILoggingEvent | DataAPIExplicitLoggingConfig> => {
    if (c === null || c === undefined) {
      return p.typeError(`Expected ${field}[${i}] to be non-null`);
    }
    if (typeof c === 'string') {
      return parseLoggingEvent(c, `${field}[${i}]`);
    }
    if (typeof config === 'object') {
      return parseExplicitLoggingConfig(c, `${field}[${i}]`);
    }
    return p.typeError(`Expected ${field}[${i}] to be of type string | object; got ${typeof config}`);
  })(config);
};

export const LoggingEvents = <const>['all', 'adminCommandStarted', 'adminCommandPolling', 'adminCommandSucceeded', 'adminCommandFailed', 'adminCommandWarning', 'commandStarted', 'commandFailed', 'commandSucceeded', 'commandWarning'];
void EqualityProof<typeof LoggingEvents[number], DataAPILoggingEvent, true>;
const parseLoggingEvent = p.mkStrEnumParser<DataAPILoggingEvent, true>('DataAPILoggingEvent', LoggingEvents, true);

const LoggingOutputs = <const>['event', 'stdout', 'stderr'];
void EqualityProof<typeof LoggingOutputs[number], DataAPILoggingOutput, true>;
const parseLoggingOutput = p.mkStrEnumParser<DataAPILoggingOutput, true>('DataAPILoggingOutput', LoggingOutputs, true);

const parseExplicitLoggingConfig = p.do<DataAPIExplicitLoggingConfig, SomeDoc>(function* (config, field) {
  const events = yield* parseLoggingConfigField(config.events, `${field}.events`, parseLoggingEvent);
  const emits = yield* parseLoggingConfigField(config.emits, `${field}.emits`, parseLoggingOutput);
  return ok({ events, emits });
});

const parseLoggingConfigField = <E>(value: unknown, field: string, parser: (x: string, field: string) => Result<E>): Result<E | E[]> => {
  if (typeof value === 'string') {
    return parser(value, field);
  }

  if (!Array.isArray(value)) {
    return p.typeError(`Expected ${field} to be a string or an array of strings; got ${typeof value}`);
  }

  if (!isNonEmpty(value)) {
    return p.error(`Expected ${field} to be non-empty`);
  }

  return r.mapM((e, i) => {
    if (typeof e !== 'string') {
      return p.typeError<E>(`Expected ${field}[${i}] to be of type string; got ${typeof e}`);
    }
    return parser(e, `${field}[${i}]`);
  })(value);
};
