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

import type { initTestObjects} from '@/tests/testlib/index.js';
import { initMemoizedTestObjects, it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';
import type { BaseClientEvent, DataAPIClientEventMap, HierarchicalLogger } from '@/src/lib/index.js';
import { LoggingEvents } from '@/src/lib/logging/constants.js';
import {
  CommandFailedEvent,
  CommandStartedEvent,
  CommandSucceededEvent,
  DataAPIResponseError,
} from '@/src/documents/index.js';
import { AdminCommandStartedEvent, AdminCommandSucceededEvent } from '@/src/administration/index.js';

type TestObjects = ReturnType<typeof initTestObjects>;

parallel('integration.lib.logging.bubbling', () => {
  interface BubblingTestSpec {
    expectOrder: `${keyof TestObjects}:${keyof DataAPIClientEventMap}:${0 | 1 | 2}`[],
    plugin?: Partial<Record<keyof TestObjects, (e: BaseClientEvent) => void>>,
    generateEvents: (objs: TestObjects, key: string) => Promise<void>,
    validateEvents: Partial<Record<keyof DataAPIClientEventMap, (e: BaseClientEvent) => void>>,
  }

  const defineBubblingTest = (testName: string, spec: BubblingTestSpec) => {
    interface TestState {
      emittedEvents: Partial<Record<keyof DataAPIClientEventMap, BaseClientEvent>>,
      emittedEventsOrder: BubblingTestSpec['expectOrder'],
      requestId?: string,
    }

    const mkTestState = (): TestState => ({ emittedEvents: {}, emittedEventsOrder: [] });

    it(testName, async (key) => {
      const emitters = initMemoizedTestObjects();
      emitters.client.removeAllListeners();

      const testStates = [] as TestState[];
      setupTestEventListeners(emitters, testStates);

      for (let i = 0; i < 3; i++) {
        const testState = mkTestState();
        testStates.push(testState);

        await spec.generateEvents(emitters, key).catch((e) => {
          if (e instanceof assert.AssertionError) {
            throw e;
          }
        });

        // ensure that the events were emitted in the correct order
        assert.deepStrictEqual(testState.emittedEventsOrder, spec.expectOrder);

        // ensure that all emitted events were as expected
        for (const [eventName, validate] of Object.entries(spec.validateEvents) as [keyof BubblingTestSpec['validateEvents'], (e: BaseClientEvent) => void][]) {
          assert.ok(testState.emittedEvents[eventName], `Expected event ${eventName} to be emitted`);
          validate(testState.emittedEvents[eventName]);
        }
      }

      // ensure that each request has a unique requestId
      assert.strictEqual(testStates.length, new Set(testStates.map(s => s.requestId)).size);

      // ensure the events are unique for each request
      assert.strictEqual(
        testStates.length * Object.values(testStates[0].emittedEvents).length,
        new Set(testStates.flatMap(s => Object.values(s.emittedEvents))).size,
      );

      // ensure that no events are emitted after removing all listeners
      testStates.push(mkTestState());

      for (const emitter of Object.values(emitters) as (HierarchicalLogger<DataAPIClientEventMap> | null)[]) {
        emitter?.removeAllListeners();
      }

      await spec.generateEvents(emitters, key).catch((e) => {
        if (e instanceof assert.AssertionError) {
          throw e;
        }
      });

      assert.deepStrictEqual(testStates.at(-1), mkTestState());
    });

    function setupTestEventListeners(emitters: TestObjects, testStates: TestState[]) {
      for (const emitterName of Object.keys(emitters) as (keyof typeof emitters)[]) {
        const emitter = emitters[emitterName] as HierarchicalLogger<DataAPIClientEventMap> | null;

        if (!emitter) {
          continue;
        }

        for (const eventName of LoggingEvents) {
          for (let i = 0; i < 3; i++) {
            emitter.on(eventName, () => {
              throw new Error('This error should not affect bubbling... (it should be silently ignored)');
            });

            emitter.on(eventName, (e: BaseClientEvent) => {
              const { emittedEvents, requestId, emittedEventsOrder } = testStates.at(-1)!;

              if (eventName in emittedEvents) {
                assert.strictEqual(emittedEvents[eventName], e); // ensure that it's the exact same event object being propagated
              } else {
                emittedEvents[eventName] = e;
              }

              if (requestId !== undefined) {
                assert.strictEqual(e.requestId, requestId); // ensure that the requestId is always the same for events generated from a single request
              } else {
                testStates.at(-1)!.requestId = e.requestId;
              }

              spec.plugin?.[emitterName]?.(e);

              emittedEventsOrder.push(`${emitterName}:${eventName}:${i as 0 | 1 | 2}`);
            });
          }
        }
      }
    }
  };

  const cartProd = (events: (keyof DataAPIClientEventMap)[], objs: (keyof TestObjects)[], indexes: (0 | 1 | 2)[]): BubblingTestSpec['expectOrder'] => {
    return events.flatMap(event => objs.flatMap(obj => indexes.map(i => <const>`${obj}:${event}:${i}`)));
  };

  defineBubblingTest('should bubble up events from collections', {
    expectOrder: cartProd(['commandStarted', 'commandSucceeded'], ['collection', 'db', 'client'], [0, 1, 2]),
    async generateEvents(objs, key) {
      await objs.collection.insertOne({ key });
    },
    validateEvents: {
      commandStarted(e: BaseClientEvent) {
        assert.ok(e instanceof CommandStartedEvent);
        assert.strictEqual(e.commandName, 'insertOne');
      },
      commandSucceeded(e: BaseClientEvent) {
        assert.ok(e instanceof CommandSucceededEvent);
        assert.strictEqual(e.commandName, 'insertOne');
      },
    },
  });

  defineBubblingTest('should bubble up events from tables', {
    expectOrder: cartProd(['commandStarted', 'commandFailed'], ['table', 'db', 'client'], [0, 1, 2]),
    async generateEvents(objs, key) {
      await objs.table.findOne({ 'non_existent_field': key });
    },
    validateEvents: {
      commandStarted(e: BaseClientEvent) {
        assert.ok(e instanceof CommandStartedEvent);
        assert.strictEqual(e.commandName, 'findOne');
      },
      commandFailed(e: BaseClientEvent) {
        assert.ok(e instanceof CommandFailedEvent);
        assert.ok(e.error instanceof DataAPIResponseError);
        assert.strictEqual(e.commandName, 'findOne');
      },
    },
  });

  defineBubblingTest('should bubble up events from db', {
    expectOrder: cartProd(['commandStarted', 'commandSucceeded'], ['db', 'client'], [0, 1, 2]),
    async generateEvents(objs) {
      await objs.db.listTables();
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

  defineBubblingTest('(ASTRA) should bubble up events from admin', {
    expectOrder: cartProd(['adminCommandStarted', 'adminCommandSucceeded'], ['admin', 'client'], [0, 1, 2]),
    async generateEvents(objs) {
      await objs.admin.listDatabases();
    },
    validateEvents: {
      adminCommandStarted(e: BaseClientEvent) {
        assert.ok(e instanceof AdminCommandStartedEvent);
        assert.strictEqual(e.methodName, 'admin.listDatabases');
      },
      adminCommandSucceeded(e: BaseClientEvent) {
        assert.ok(e instanceof AdminCommandSucceededEvent);
        assert.strictEqual(e.methodName, 'admin.listDatabases');
      },
    },
  });

  defineBubblingTest('should bubble up events from dbAdmin', {
    expectOrder: cartProd(['adminCommandStarted', 'adminCommandSucceeded'], ['dbAdmin', 'client'], [0, 1, 2]),
    async generateEvents(objs) {
      await objs.dbAdmin.listKeyspaces();
    },
    validateEvents: {
      adminCommandStarted(e: BaseClientEvent) {
        assert.ok(e instanceof AdminCommandStartedEvent);
        assert.strictEqual(e.methodName, 'dbAdmin.listKeyspaces');
      },
      adminCommandSucceeded(e: BaseClientEvent) {
        assert.ok(e instanceof AdminCommandSucceededEvent);
        assert.strictEqual(e.methodName, 'dbAdmin.listKeyspaces');
      },
    },
  });

  defineBubblingTest('should stop propagation at the source', {
    expectOrder: cartProd(['commandStarted', 'commandSucceeded'], ['collection'], [0, 1, 2]),
    async generateEvents(objs, key) {
      await objs.collection.insertOne({ key });
    },
    plugin: {
      collection: (e) => e.stopPropagation(),
    },
    validateEvents: {
      commandStarted(e: BaseClientEvent) {
        assert.ok(e instanceof CommandStartedEvent);
        assert.strictEqual(e.commandName, 'insertOne');
      },
      commandSucceeded(e: BaseClientEvent) {
        assert.ok(e instanceof CommandSucceededEvent);
        assert.strictEqual(e.commandName, 'insertOne');
      },
    },
  });

  defineBubblingTest('should stop propagation at a higher level', {
    expectOrder: cartProd(['commandStarted', 'commandSucceeded'], ['collection', 'db'], [0, 1, 2]),
    async generateEvents(objs, key) {
      await objs.collection.insertOne({ key });
    },
    plugin: {
      db: (e) => e.stopPropagation(),
    },
    validateEvents: {
      commandStarted(e: BaseClientEvent) {
        assert.ok(e instanceof CommandStartedEvent);
        assert.strictEqual(e.commandName, 'insertOne');
      },
      commandSucceeded(e: BaseClientEvent) {
        assert.ok(e instanceof CommandSucceededEvent);
        assert.strictEqual(e.commandName, 'insertOne');
      },
    },
  });

  defineBubblingTest('should stop immediate propagation at the source', {
    expectOrder: cartProd(['commandStarted', 'commandSucceeded'], ['collection'], [0]),
    async generateEvents(objs, key) {
      await objs.collection.insertOne({ key });
    },
    plugin: {
      collection: (e) => e.stopImmediatePropagation(),
    },
    validateEvents: {
      commandStarted(e: BaseClientEvent) {
        assert.ok(e instanceof CommandStartedEvent);
        assert.strictEqual(e.commandName, 'insertOne');
      },
      commandSucceeded(e: BaseClientEvent) {
        assert.ok(e instanceof CommandSucceededEvent);
        assert.strictEqual(e.commandName, 'insertOne');
      },
    },
  });

  defineBubblingTest('should stop immediate propagation at a higher level', {
    expectOrder: cartProd(['commandStarted', 'commandSucceeded'], ['collection', 'db'], [0, 1, 2]).filter(e => !e.startsWith('db') || e.endsWith('0')),
    async generateEvents(objs, key) {
      await objs.collection.insertOne({ key });
    },
    plugin: {
      db: (e) => e.stopImmediatePropagation(),
    },
    validateEvents: {
      commandStarted(e: BaseClientEvent) {
        assert.ok(e instanceof CommandStartedEvent);
        assert.strictEqual(e.commandName, 'insertOne');
      },
      commandSucceeded(e: BaseClientEvent) {
        assert.ok(e instanceof CommandSucceededEvent);
        assert.strictEqual(e.commandName, 'insertOne');
      },
    },
  });
});
