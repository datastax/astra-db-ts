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

import { initTestObjects, it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';
import type { BaseClientEvent, DataAPIClientEventMap } from '@/src/lib/index.js';
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
  interface LoggingTestSpec {
    expect: `${keyof TestObjects}:${keyof DataAPIClientEventMap}:${0 | 1 | 2}`[],
    plugin?: Partial<Record<keyof TestObjects, (e: BaseClientEvent) => void>>,
    command: (objs: TestObjects, key: string) => Promise<void>,
    validate: Partial<Record<keyof DataAPIClientEventMap, (e: BaseClientEvent) => void>>,
  }

  const defineBubblingTest = (desc: string, spec: LoggingTestSpec) => {
    it(desc, async (key) => {
      const objs = initTestObjects();
      objs.client.removeAllListeners();

      const order: LoggingTestSpec['expect'] = [];
      const emitted: Partial<Record<keyof DataAPIClientEventMap, BaseClientEvent>> = {};
      let referenceId: string | undefined;

      for (const objName of Object.keys(objs) as (keyof typeof objs)[]) {
        for (const eventName of LoggingEvents) {
          for (let i = 0; i < 3; i++) {
            (objs[objName]?.on as any)?.(eventName, (e: BaseClientEvent) => {
              eventName in emitted && assert.strictEqual(emitted[eventName], e);
              referenceId !== undefined && assert.strictEqual(e.requestId, referenceId);
              referenceId = e.requestId;
              emitted[eventName] = e;
              spec.plugin?.[objName]?.(e);
              order.push(`${objName}:${eventName}:${i as 0 | 1 | 2}`);
            });
          }
        }
      }

      await spec.command(objs, key).catch((e) => {
        if (e instanceof assert.AssertionError) {
          throw e;
        }
      });
      assert.deepStrictEqual(order, spec.expect);

      for (const [eventName, validate] of Object.entries(spec.validate) as [keyof LoggingTestSpec['validate'], (e: BaseClientEvent) => void][]) {
        assert.ok(emitted[eventName], `Expected event ${eventName} to be emitted`);
        validate(emitted[eventName]);
      }
    });
  };

  const cartProd = (events: (keyof DataAPIClientEventMap)[], objs: (keyof TestObjects)[], indexes: (0 | 1 | 2)[]): LoggingTestSpec['expect'] => {
    return events.flatMap(event => objs.flatMap(obj => indexes.map(i => <const>`${obj}:${event}:${i}`)));
  };

  defineBubblingTest('should bubble up events from collections', {
    expect: cartProd(['commandStarted', 'commandSucceeded'], ['collection', 'db', 'client'], [0, 1, 2]),
    async command(objs, key) {
      await objs.collection.insertOne({ key });
    },
    validate: {
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
    expect: cartProd(['commandStarted', 'commandFailed'], ['table', 'db', 'client'], [0, 1, 2]),
    async command(objs, key) {
      await objs.table.findOne({ key });
    },
    validate: {
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
    expect: cartProd(['commandStarted', 'commandSucceeded'], ['db', 'client'], [0, 1, 2]),
    async command(objs) {
      await objs.db.listTables();
    },
    validate: {
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
    expect: cartProd(['adminCommandStarted', 'adminCommandSucceeded'], ['admin', 'client'], [0, 1, 2]),
    async command(objs) {
      await objs.admin.listDatabases();
    },
    validate: {
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
    expect: cartProd(['adminCommandStarted', 'adminCommandSucceeded'], ['dbAdmin', 'client'], [0, 1, 2]),
    async command(objs) {
      await objs.dbAdmin.listKeyspaces();
    },
    validate: {
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
    expect: cartProd(['commandStarted', 'commandSucceeded'], ['collection'], [0, 1, 2]),
    async command(objs, key) {
      await objs.collection.insertOne({ key });
    },
    plugin: {
      collection: (e) => e.stopPropagation(),
    },
    validate: {
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
    expect: cartProd(['commandStarted', 'commandSucceeded'], ['collection', 'db'], [0, 1, 2]),
    async command(objs, key) {
      await objs.collection.insertOne({ key });
    },
    plugin: {
      db: (e) => e.stopPropagation(),
    },
    validate: {
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
    expect: cartProd(['commandStarted', 'commandSucceeded'], ['collection'], [0]),
    async command(objs, key) {
      await objs.collection.insertOne({ key });
    },
    plugin: {
      collection: (e) => e.stopImmediatePropagation(),
    },
    validate: {
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
    expect: cartProd(['commandStarted', 'commandSucceeded'], ['collection', 'db'], [0, 1, 2]).filter(e => !e.startsWith('db') || e.endsWith('0')),
    async command(objs, key) {
      await objs.collection.insertOne({ key });
    },
    plugin: {
      db: (e) => e.stopImmediatePropagation(),
    },
    validate: {
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
