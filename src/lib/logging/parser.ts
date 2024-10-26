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

import { isNonEmpty, p, Parser } from '@/src/lib/validation';
import {
  DataAPIExplicitLoggingConfig,
  DataAPILoggingConfig,
  DataAPILoggingEvent,
  DataAPILoggingOutput,
} from '@/src/lib';
import { isNullish } from '@/src/lib/utils';
import { LoggingEvents, LoggingOutputs } from '@/src/lib/logging/constants';

const parseLoggingEvent = p.mkStrEnumParser<DataAPILoggingEvent, true>('DataAPILoggingEvent', LoggingEvents, true);
const parseLoggingOutput = p.mkStrEnumParser<DataAPILoggingOutput, true>('DataAPILoggingOutput', LoggingOutputs, true);

export const parseLoggingConfig: Parser<DataAPILoggingConfig | undefined> = (config, field) => {
  if (isNullish(config)) {
    return undefined;
  }

  if (typeof config === 'string') {
    return parseLoggingEvent(config, `${field}`);
  }

  if (!Array.isArray(config)) {
    throw new TypeError(`Expected ${field} to be of type string | (string | object[]); got ${typeof config}`);
  }

  if (!isNonEmpty(config)) {
    throw new Error(`Expected ${field} array to be non-empty`);
  }

  return config.map((c, i) => {
    if (c === null || c === undefined) {
      throw new TypeError(`Expected ${field}[${i}] to be non-null`);
    }
    if (typeof c === 'string') {
      return parseLoggingEvent(c, `${field}[${i}]`);
    }
    if (typeof c === 'object') {
      return parseExplicitLoggingConfig(c, `${field}[${i}]`);
    }
    throw new TypeError(`Expected ${field}[${i}] to be of type string | object; got ${typeof c}`);
  });
};

const parseExplicitLoggingConfig: Parser<DataAPIExplicitLoggingConfig> = (config, field) => {
  const events = parseLoggingConfigField(config.events, `${field}.events`, true, parseLoggingEvent);
  const emits = parseLoggingConfigField(config.emits, `${field}.emits`, false, parseLoggingOutput);
  return { events, emits };
};

const parseLoggingConfigField = <E>(value: unknown, field: string, reqNonEmpty: boolean, parser: (x: string, field: string) => E): E | E[] => {
  if (typeof value === 'string') {
    return parser(value, field);
  }

  if (!Array.isArray(value)) {
    throw new TypeError(`Expected ${field} to be a string or an array of strings; got ${typeof value}`);
  }

  if (reqNonEmpty && !isNonEmpty(value)) {
    throw new Error(`Expected ${field} to be non-empty`);
  }

  return value.map((e, i) => {
    return parser(e, `${field}[${i}]`);
  });
};
