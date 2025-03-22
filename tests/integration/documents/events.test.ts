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

import assert from 'assert';
import type { EverythingTableSchema } from '@/tests/testlib/index.js';
import { initTestObjects, it, parallel } from '@/tests/testlib/index.js';
import { memoizeRequests } from '@/tests/testlib/utils.js';
import { CommandEventMap, DataAPIResponseError, Table } from '@/src/documents/index.js';
import {
  CommandFailedEvent,
  CommandStartedEvent,
  CommandSucceededEvent,
  CommandWarningsEvent,
} from '@/src/documents/index.js';

parallel('integration.documents.events', () => {
  interface EventsTestSpec<EventName extends keyof CommandEventMap> {
    eventName: EventName,
    generateEvent: (table: Table<EverythingTableSchema>, key: string) => Promise<void>
    validateEvent: (table: Table<EverythingTableSchema>, e: CommandEventMap[EventName]) => void,
  }

  const defineEventsTest = <EventName extends keyof CommandEventMap>(testName: `${string}${NoInfer<EventName>}${string}`, spec: EventsTestSpec<NoInfer<EventName>>) => {
    it(testName, async (key) => {
      const table = memoizeRequests(initTestObjects().table);

      const emissions: CommandEventMap[EventName][] = [];

      table.on(spec.eventName, (e) => {
        emissions.push(e);
      });

      await generateEvent({ times: 1 });

      async function generateEvent(cfg: { times: number }) {
        for (let i = 0; i < cfg.times; i++) {
          await spec.generateEvent(table, key).catch((e) => {
            if (e instanceof assert.AssertionError) throw e;
          });
        }

        assert.strictEqual(emissions.length, cfg.times);
        assert.strictEqual(emissions.length, new Set(emissions.map(e => e.requestId)).size);

        for (const e of emissions) {
          spec.validateEvent(table, e);
        }

        emissions.length = 0;
      }
    });
  };

  defineEventsTest('should emit commandStarted events', {
    eventName: 'commandStarted',
    async generateEvent(table) {
      await table.findOne({});
    },
    validateEvent(_, e) {
      assert.ok(e instanceof CommandStartedEvent);
      assert.strictEqual(e.getMessage(), '');
      assert.strictEqual(e.getMessagePrefix(), 'test_table::findOne');
    },
  });

  defineEventsTest('should emit commandSucceeded events', {
    eventName: 'commandSucceeded',
    async generateEvent(table) {
      await table.findOne({});
    },
    validateEvent(_, e) {
      assert.ok(e instanceof CommandSucceededEvent);
      assert.match(e.getMessage(), /^\(\d+ms\)$/);
      assert.strictEqual(e.getMessagePrefix(), 'test_table::findOne');
    },
  });

  defineEventsTest('should emit commandFailed events', {
    eventName: 'commandFailed',
    async generateEvent(table) {
      await table.findOne({ invalidField: 3 });
    },
    validateEvent(_, e) {
      assert.ok(e instanceof CommandFailedEvent);
      assert.match(e.getMessage(), /^\(\d+ms\) ERROR: [^\n]/);
      assert.strictEqual(e.getMessagePrefix(), 'test_table::findOne');
      assert.notDeepStrictEqual(e, e.trimDuplicateFields());
      assert.ok(e.error instanceof DataAPIResponseError);
      assert.strictEqual(e.error.errorDescriptors.length, 1);
      assert.strictEqual(e.error.warnings.length, 0);
    },
  });

  defineEventsTest('should emit commandWarnings events', {
    eventName: 'commandWarnings',
    async generateEvent(table) {
      await table.findOne({});
    },
    validateEvent(_, e) {
      assert.ok(e instanceof CommandWarningsEvent);
      assert.match(e.getMessage(), /^WARNINGS: .*/);
      assert.strictEqual(e.getMessagePrefix(), 'test_table::findOne');
    },
  });
});
