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

import assert from 'assert';
import { describe, it } from '@/tests/testlib';
import { parseLoggingConfig } from '@/src/lib/logging/parser';
import { LoggingEvents } from '@/src/lib/logging/constants';

describe('unit.lib.logging.parser', () => {
  it('should return undefined when config is nullish', () => {
    assert.strictEqual(parseLoggingConfig(null!, 'config'), undefined);
    assert.strictEqual(parseLoggingConfig(undefined, 'config'), undefined);
  });

  it('should correctly parse a single event', () => {
    for (const event of LoggingEvents) {
      assert.doesNotThrow(() => parseLoggingConfig(event, 'config'));
    }
    assert.throws(() => parseLoggingConfig('unknown' as any, 'config'));
  });

  it('should throw if config is/has invalid type', () => {
    assert.throws(() => parseLoggingConfig({} as any, 'config'), { message: 'Expected config to be of type string | (string | object[]); got object' });
    assert.throws(() => parseLoggingConfig(['all', null!], 'config'), { message: 'Expected config[1] to be non-null' });
    assert.throws(() => parseLoggingConfig([3 as any, null!], 'config'), { message: 'Expected config[0] to be of type string | object; got number' });
    assert.throws(() => parseLoggingConfig([{ events: 3 as any, emits: [] }, null!], 'config'), { message: 'Expected config[0].events to be a string or an array of strings; got number' });
    assert.throws(() => parseLoggingConfig([{ events: ['all'], emits: 3 as any }, null!], 'config'), { message: 'Expected config[0].emits to be a string or an array of strings; got number' });
    assert.throws(() => parseLoggingConfig([{ events: ['commandSucceeded', 3 as any], emits: [] }, null!], 'config'), { message: 'Expected config[0].events[1] to be of string enum DataAPILoggingEvent, but got number' });
    assert.throws(() => parseLoggingConfig([{ events: 'all', emits: [3 as any] }, null!], 'config'), { message: 'Expected config[0].emits[0] to be of string enum DataAPILoggingOutput, but got number' });
    assert.throws(() => parseLoggingConfig([{ events: [null!], emits: [] }, null!], 'config'), { message: 'Expected config[0].events[0] to be of string enum DataAPILoggingEvent, but got object' });
    assert.throws(() => parseLoggingConfig([{ events: 'all', emits: ['event', 'idk' as any] }, null!], 'config'), { message: 'Expected config[0].emits[1] to be of string enum DataAPILoggingOutput (one of event, stdout, stderr), but got \'idk\'' });
    assert.throws(() => parseLoggingConfig(['all', { events: ['idk' as any], emits: [] }, null!], 'config'), { message: 'Expected config[1].events[0] to be of string enum DataAPILoggingEvent (one of all, adminCommandStarted, adminCommandPolling, adminCommandSucceeded, adminCommandFailed, adminCommandWarnings, commandStarted, commandFailed, commandSucceeded, commandWarnings), but got \'idk\'' });
  });

  it('should throw if config is nonsensical', () => {
    assert.throws(() => parseLoggingConfig([], 'config'), { message: 'Expected config array to be non-empty' });
    assert.throws(() => parseLoggingConfig([{ events: [], emits: [] }, null!], 'config'), { message: 'Expected config[0].events to be non-empty' });
  });

  it('should parse valid configs', () => {
    assert.doesNotThrow(() => parseLoggingConfig('all', 'config'));
    assert.doesNotThrow(() => parseLoggingConfig('commandSucceeded', 'config'));
    assert.doesNotThrow(() => parseLoggingConfig(['commandSucceeded', 'commandFailed'], 'config'));
    assert.doesNotThrow(() => parseLoggingConfig([{ events: 'all', emits: [] }], 'config'));
    assert.doesNotThrow(() => parseLoggingConfig([{ events: 'all', emits: ['event'] }], 'config'));
    assert.doesNotThrow(() => parseLoggingConfig([{ events: ['all'], emits: ['event', 'stdout', 'stderr'] }], 'config'));
    assert.doesNotThrow(() => parseLoggingConfig([{ events: ['commandFailed', 'all'], emits: ['event', 'stdout', 'stderr'] }], 'config'));
    assert.doesNotThrow(() => parseLoggingConfig([{ events: 'all', emits: ['stderr'] }, { events: 'commandFailed', emits: [] }], 'config'));
    assert.doesNotThrow(() => parseLoggingConfig(['all', { events: 'all', emits: ['stderr'] }, { events: ['commandFailed'], emits: [] }, 'commandFailed'], 'config'));
  });
});
