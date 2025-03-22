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

import { describe, initTestObjects, it, parallel } from '@/tests/testlib/index.js';
import type { LoggingConfig } from '@/src/lib/index.js';
import { BaseClientEvent, LoggingEvents } from '@/src/lib/index.js';
import assert from 'assert';
import { before } from 'mocha';

describe('integration.lib.logging.outputs', () => {
  const initTestObjsWithCapturedOutput = (logging: LoggingConfig) => {
    const _console = global.console;
    global.console = {
      log: (msg: string) => {
        stdout.push(msg);
      },
      error: (msg: string) => {
        stderr.push(msg);
      },
    } as Console;

    const objs = initTestObjects({ logging });
    const stdout: string[] = [], stderr: string[] = [], events: BaseClientEvent[] = [];

    for (const event of LoggingEvents) {
      objs.client.on(event, (e) => events.push(e));
    }

    global.console = _console;

    return { objs, stdout, stderr, events };
  };

  parallel('parallelize', () => {
    it('should log to stdout', async () => {
      const { objs, stdout, stderr, events } = initTestObjsWithCapturedOutput([{ events: 'all', emits: ['stdout', 'event'] }]);

      await objs.db.listTables();
      await objs.db.collection('iDontExistTTT').options().catch(() => {});
      
      assert.deepStrictEqual(stdout.length, 4);
      assert.deepStrictEqual(stdout, events.map((e) => e.format()));
      assert.deepStrictEqual(stderr, []);
      assert.strictEqual(new Set(events.map((e) => e.requestId)).size, 2);
    });

    it('should log to stderr', async () => {
      const { objs, stdout, stderr, events } = initTestObjsWithCapturedOutput([{ events: /.*/, emits: ['stderr', 'event'] }]);

      await objs.db.listTables();
      await objs.db.collection('iDontExistTTT').options().catch(() => {});

      assert.deepStrictEqual(stderr.length, 4);
      assert.deepStrictEqual(stderr, events.map((e) => e.format()));
      assert.deepStrictEqual(stdout, []);
      assert.strictEqual(new Set(events.map((e) => e.requestId)).size, 2);
    });

    it('should log to stdout:verbose', async () => {
      const { objs, stdout, stderr, events } = initTestObjsWithCapturedOutput([{ events: /.*/, emits: ['stdout:verbose', 'event'] }]);

      await objs.db.listTables();
      await objs.db.collection('iDontExistTTT').options().catch(() => {});

      assert.deepStrictEqual(stdout.length, 4);
      assert.deepStrictEqual(stdout, events.map((e) => e.formatVerbose()));
      assert.deepStrictEqual(stderr, []);
      assert.strictEqual(new Set(events.map((e) => e.requestId)).size, 2);
    });

    it('should log to stderr:verbose', async () => {
      const { objs, stdout, stderr, events } = initTestObjsWithCapturedOutput([{ events: 'all', emits: ['stderr:verbose', 'event'] }]);

      await objs.db.listTables();
      await objs.db.collection('iDontExistTTT').options().catch(() => {});

      assert.deepStrictEqual(stderr.length, 4);
      assert.deepStrictEqual(stderr, events.map((e) => e.formatVerbose()));
      assert.deepStrictEqual(stdout, []);
      assert.strictEqual(new Set(events.map((e) => e.requestId)).size, 2);
    });
  });

  parallel('custom formatter', () => {
    const defaultFormatter = BaseClientEvent['_defaultFormatter'];

    before(() => BaseClientEvent.setDefaultFormatter((event, message) => `${JSON.stringify(event)},${message}`));
    after(() => BaseClientEvent.setDefaultFormatter(defaultFormatter));

    it('should log to stdout with a custom formatter', async () => {
      const { objs, stdout, stderr, events } = initTestObjsWithCapturedOutput([{ events: /.*/, emits: ['stdout', 'event'] }]);

      await objs.db.listTables();
      await objs.db.collection('iDontExistTTT').options().catch(() => {});

      assert.deepStrictEqual(stdout.length, 4);
      assert.deepStrictEqual(stdout, events.map((e) => `${JSON.stringify(e)},${e.getMessagePrefix() + ' ' + e.getMessage()}`));
      assert.deepStrictEqual(stderr, []);
      assert.strictEqual(new Set(events.map((e) => e.requestId)).size, 2);
    });

    it('should log to stderr with a custom formatter', async () => {
      const { objs, stdout, stderr, events } = initTestObjsWithCapturedOutput([{ events: 'all', emits: ['stderr', 'event'] }]);

      await objs.db.listTables();
      await objs.db.collection('iDontExistTTT').options().catch(() => {});

      assert.deepStrictEqual(stderr.length, 4);
      assert.deepStrictEqual(stderr, events.map((e) => `${JSON.stringify(e)},${e.getMessagePrefix() + ' ' + e.getMessage()}`));
      assert.deepStrictEqual(stdout, []);
      assert.strictEqual(new Set(events.map((e) => e.requestId)).size, 2);
    });
  });
});
