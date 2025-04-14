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

import type { initTestObjects } from '@/tests/testlib/index.js';
import { initMemoizedTestObjects, it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';
import type { BaseClientEvent, DataAPIClientEventMap, HierarchicalLogger } from '@/src/lib/index.js';
import {
  CommandFailedEvent,
  CommandStartedEvent,
  CommandSucceededEvent,
  CommandWarningsEvent,
} from '@/src/documents/index.js';
import { AdminCommandStartedEvent, AdminCommandSucceededEvent } from '@/src/administration/index.js';
import { DeltaAsserter } from '@/tests/testlib/utils.js';

type TestObjects = ReturnType<typeof initTestObjects>;

const LoggerDeltaAsserter = new DeltaAsserter(['internal']);

parallel('integration.lib.logging.lifecycle', () => {
  interface LifecycleTestSpec<Emitter extends HierarchicalLogger<DataAPIClientEventMap>, StartEvent extends keyof DataAPIClientEventMap, SucceedEvent extends keyof DataAPIClientEventMap> {
    pickEmitter: (objs: TestObjects) => Emitter;
    events: { start: StartEvent, end: SucceedEvent };
    generateEvents: (emitter: Emitter, key: string) => Promise<void>,
    validateEvents: Record<StartEvent | SucceedEvent, (e: BaseClientEvent) => void>,
  }

  const defineLifecycleTest = <Emitter extends HierarchicalLogger<DataAPIClientEventMap>, StartEvent extends keyof DataAPIClientEventMap, SucceedEvent extends keyof DataAPIClientEventMap>(testName: string, spec: LifecycleTestSpec<Emitter, StartEvent, SucceedEvent>) => {
    it(testName, async (key) => {
      const emitter = initTestEmitter();

      const callOrder = [] as (StartEvent | SucceedEvent)[];

      const startEmissions: BaseClientEvent[] = [];
      const endEmissions: BaseClientEvent[] = [];

      const startListener = (e: BaseClientEvent) => {
        callOrder.push(spec.events.start);
        startEmissions.push(e);
      };

      const endListener = (e: BaseClientEvent) => {
        callOrder.push(spec.events.end);
        endEmissions.push(e);
      };

      // test the lifecycle of a single listener
      {
        const startListenerOff = emitter.on(spec.events.start, startListener);
        const endListenerOff = emitter.on(spec.events.end, endListener);

        await generateEvents({ times: 3, callOrder, expectOrder: [spec.events.start, spec.events.end] });

        LoggerDeltaAsserter.assertMutDelta(emitter, () => {
          emitter.off(spec.events.start, startListener);
        });

        LoggerDeltaAsserter.assertNoMutDelta(emitter, () => {
          startListenerOff();
          emitter.off(spec.events.start, startListener);
          emitter.off(spec.events.start, () => {});
          emitter.removeAllListeners(spec.events.start);
        });

        await generateEvents({ times: 3, callOrder, expectOrder: [spec.events.end] });

        LoggerDeltaAsserter.assertMutDelta(emitter, (() => {
          endListenerOff();
        }));

        LoggerDeltaAsserter.assertNoMutDelta(emitter, (() => {
          endListenerOff();
          emitter.off(spec.events.start, startListener);
          emitter.off(spec.events.end, endListener);
          emitter.removeAllListeners(spec.events.start);
          emitter.removeAllListeners(spec.events.end);
        }));

        await generateEvents({ times: 3, callOrder, expectOrder: [] });
      }

      // testing removeAllListeners
      {
        const startListeners = Array.from({ length: 5 }, () => (e: BaseClientEvent) => startListener(e));

        LoggerDeltaAsserter.assertMutDelta(emitter, (() => {
          startListeners.forEach((listener) => emitter.on(spec.events.start, listener));
        }));

        await generateEvents({ times: 3, callOrder, expectOrder: Array(5).fill(spec.events.start) });

        LoggerDeltaAsserter.assertMutDelta(emitter, (() => {
          emitter.off(spec.events.start, startListeners[0]);
        }));

        LoggerDeltaAsserter.assertNoMutDelta(emitter, (() => {
          emitter.off(spec.events.start, startListeners[0]);
          emitter.off(spec.events.start, startListener);
        }));

        await generateEvents({ times: 3, callOrder, expectOrder: Array(4).fill(spec.events.start) });

        LoggerDeltaAsserter.assertMutDelta(emitter, (() => {
          emitter.removeAllListeners(spec.events.start);
        }));

        LoggerDeltaAsserter.assertNoMutDelta(emitter, (() => {
          emitter.removeAllListeners(spec.events.start);
          startListeners.forEach((listener) => emitter.off(spec.events.start, listener));
        }));

        await generateEvents({ times: 3, callOrder, expectOrder: [] });
      }

      // testing once
      {
        const startListeners = Array.from({ length: 5 }, () => (e: BaseClientEvent) => startListener(e));

        LoggerDeltaAsserter.assertMutDelta(emitter, (() => {
          startListeners.forEach((listener) => emitter.once(spec.events.start, listener));
        }));

        await generateEvents({ times: 3, callOrder, expectOrder: Array(5).fill(spec.events.start), expectTimes: 1 });
      }

      // testing some noop-y stuff
      {
        LoggerDeltaAsserter.assertNoMutDelta(emitter, (() => {
          const off = emitter.on(spec.events.start, startListener);
          off();
        }));

        await LoggerDeltaAsserter.assertNoMutDelta(emitter, (async () => {
          emitter.once(spec.events.start, () => {
            throw new Error('This should not affect anything...');
          });

          emitter.once(spec.events.end, () => {
            throw new Error('This should not affect anything...');
          });

          emitter.once(spec.events.start, startListener);
          emitter.once(spec.events.start, startListener);

          await generateEvents({ times: 3, callOrder, expectOrder: [spec.events.start, spec.events.start], expectTimes: 1 });
        }));

        emitter.removeAllListeners();
      }

      // testing updateLoggingConfig
      {
        LoggerDeltaAsserter.assertMutDelta(emitter, (() => {
          emitter.on(spec.events.start, startListener);
          emitter.on(spec.events.end, endListener);
        }));

        await generateEvents({ times: 3, callOrder, expectOrder: [spec.events.start, spec.events.end] });

        LoggerDeltaAsserter.assertMutDelta(emitter, (() => {
          emitter.updateLoggingConfig([{ events: [spec.events.start], emits: [] }]);
        }));

        await generateEvents({ times: 3, callOrder, expectOrder: [spec.events.end] });

        LoggerDeltaAsserter.assertMutDelta(emitter, (() => {
          emitter.updateLoggingConfig([{ events: [spec.events.start], emits: ['event'] }]);
          emitter.updateLoggingConfig([{ events: [spec.events.end], emits: [] }]);
        }));

        await generateEvents({ times: 3, callOrder, expectOrder: [spec.events.start] });

        LoggerDeltaAsserter.assertMutDelta(emitter, (() => {
          emitter.updateLoggingConfig([{ events: [spec.events.start], emits: [] }]);
          emitter.updateLoggingConfig([{ events: [spec.events.end], emits: [] }]);
        }));

        await generateEvents({ times: 3, callOrder, expectOrder: [] });

        LoggerDeltaAsserter.assertMutDelta(emitter, (() => {
          emitter.updateLoggingConfig([{ events: 'all', emits: ['event'] }]);
        }));

        await generateEvents({ times: 3, callOrder, expectOrder: [spec.events.start, spec.events.end] });

        LoggerDeltaAsserter.assertNoMutDelta(emitter, (() => {
          assert.throws(() => emitter.updateLoggingConfig([{ events: 'all', emits: ['stderr', 'stdout'] }]));
        }));
      }

      startEmissions.forEach(spec.validateEvents[spec.events.start]);
      endEmissions.forEach(spec.validateEvents[spec.events.end]);

      function initTestEmitter() {
        const emitter = spec.pickEmitter(initMemoizedTestObjects());
        emitter.removeAllListeners();
        return emitter;
      }

      async function generateEvents(cfg: { times: number } | { times: number, callOrder: (StartEvent | SucceedEvent)[], expectOrder: (StartEvent | SucceedEvent)[], expectTimes?: number }) {
        for (let i = 0; i < cfg.times; i++) {
          await spec.generateEvents(emitter, key).catch((e) => {
            if (e instanceof assert.AssertionError) {
              throw e;
            }
          });
        }

        if ('callOrder' in cfg) {
          const expectTimes = cfg.expectTimes ?? cfg.times;
          assert.deepStrictEqual(cfg.callOrder, Array(expectTimes).fill(cfg.expectOrder).flat(), `Expected ${JSON.stringify(cfg.expectOrder)} * ${expectTimes} but got ${JSON.stringify(cfg.callOrder)}`);
          cfg.callOrder.length = 0;
        }
      }
    });
  };

  defineLifecycleTest('should work for the lifecycle of a collection', {
    pickEmitter: (objs) => objs.collection,
    events: { start: 'commandStarted', end: 'commandFailed' },
    async generateEvents(collection) {
      await collection.insertOne({ '': '' });
    },
    validateEvents: {
      commandStarted(e: BaseClientEvent) {
        assert.ok(e instanceof CommandStartedEvent);
        assert.strictEqual(e.commandName, 'insertOne');
      },
      commandFailed(e: BaseClientEvent) {
        assert.ok(e instanceof CommandFailedEvent);
        assert.strictEqual(e.commandName, 'insertOne');
      },
    },
  });

  defineLifecycleTest('should work for the lifecycle of a table', {
    pickEmitter: (objs) => objs.table,
    events: { start: 'commandStarted', end: 'commandWarnings' },
    async generateEvents(table) {
      await table.findOne({});
    },
    validateEvents: {
      commandStarted(e: BaseClientEvent) {
        assert.ok(e instanceof CommandStartedEvent);
        assert.strictEqual(e.commandName, 'findOne');
      },
      commandWarnings(e: BaseClientEvent) {
        assert.ok(e instanceof CommandWarningsEvent);
        assert.strictEqual(e.commandName, 'findOne');
      },
    },
  });

  defineLifecycleTest('should work for the lifecycle of a db', {
    pickEmitter: (objs) => objs.db,
    events: { start: 'commandStarted', end: 'commandSucceeded' },
    async generateEvents(db) {
      await db.listTables();
    },
    validateEvents: {
      commandStarted(e: BaseClientEvent) {
        assert.ok(e instanceof CommandStartedEvent);
        assert.strictEqual(e.commandName, 'listTables');
      },
      commandSucceeded(e: BaseClientEvent) {
        assert.ok(e instanceof CommandSucceededEvent);
        assert.strictEqual(e.commandName, 'listTables');
      },
    },
  });

  defineLifecycleTest('(ASTRA) should work for the lifecycle of an admin', {
    pickEmitter: (objs) => objs.admin,
    events: { start: 'adminCommandStarted', end: 'adminCommandSucceeded' },
    async generateEvents(admin) {
      await admin.listDatabases();
    },
    validateEvents: {
      adminCommandStarted(e: BaseClientEvent) {
        assert.ok(e instanceof AdminCommandStartedEvent);
        assert.strictEqual(e.invokingMethod, 'admin.listDatabases');
      },
      adminCommandSucceeded(e: BaseClientEvent) {
        assert.ok(e instanceof AdminCommandSucceededEvent);
        assert.strictEqual(e.invokingMethod, 'admin.listDatabases');
      },
    },
  });

  defineLifecycleTest('should work for the lifecycle of a dbAdmin', {
    pickEmitter: (objs) => objs.dbAdmin,
    events: { start: 'adminCommandStarted', end: 'adminCommandSucceeded' },
    async generateEvents(dbAdmin) {
      await dbAdmin.listKeyspaces();
    },
    validateEvents: {
      adminCommandStarted(e: BaseClientEvent) {
        assert.ok(e instanceof AdminCommandStartedEvent);
        assert.strictEqual(e.invokingMethod, 'dbAdmin.listKeyspaces');
      },
      adminCommandSucceeded(e: BaseClientEvent) {
        assert.ok(e instanceof AdminCommandSucceededEvent);
        assert.strictEqual(e.invokingMethod, 'dbAdmin.listKeyspaces');
      },
    },
  });
});
