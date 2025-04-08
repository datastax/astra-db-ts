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
import { initTestObjects, it, parallel, TEST_APPLICATION_URI } from '@/tests/testlib/index.js';
import type { AdminCommandEventMap, DbAdmin } from '@/src/administration/index.js';
import {
  AdminCommandFailedEvent,
  AdminCommandStartedEvent,
  AdminCommandSucceededEvent,
  AdminCommandWarningsEvent,
  AstraDbAdmin,
  DataAPIDbAdmin,
} from '@/src/administration/index.js';
import { memoizeRequests } from '@/tests/testlib/utils.js';
import { DEFAULT_DEVOPS_API_ENDPOINTS } from '@/src/lib/api/constants.js';
import { extractAstraEnvironment } from '@/src/administration/utils.js';

parallel('integration.administration.events', () => {
  type EventsTestSpec<EventName extends keyof AdminCommandEventMap> = EventGenerator & EventValidator<AdminCommandEventMap[EventName]> & {
    eventName: EventName,
  };

  type EventGenerator =
    | { generateEvent: (dbAdmin: AstraDbAdmin | DataAPIDbAdmin, key: string) => Promise<void> }
    | { generateEventAstra: (dbAdmin: AstraDbAdmin, key: string) => Promise<void>, generateEventDAPI: (dbAdmin: DataAPIDbAdmin, key: string) => Promise<void> }

  interface EventValidator<Event> {
    validateEvent: (dbAdmin: AstraDbAdmin | DataAPIDbAdmin, e: Event) => void,
    validateEventAstra?: (dbAdmin: AstraDbAdmin, e: Event) => void,
    validateEventDAPI?: (dbAdmin: DataAPIDbAdmin, e: Event) => void,
  }

  const defineEventsTest = <EventName extends keyof AdminCommandEventMap>(testName: `${string}${NoInfer<EventName>}${string}`, spec: EventsTestSpec<NoInfer<EventName>>) => {
    it(testName, async (key) => {
      const dbAdmin = memoizeRequests(initTestObjects().dbAdmin);

      const emissions: AdminCommandEventMap[EventName][] = [];

      dbAdmin.on(spec.eventName, (e) => {
        emissions.push(e);
      });

      await generateEvent({ times: 1 });

      async function generateEvent(cfg: { times: number }) {
        for (let i = 0; i < cfg.times; i++) {
          if ('generateEvent' in spec) {
            await spec.generateEvent(dbAdmin, key).catch((e) => {
              if (e instanceof assert.AssertionError) throw e;
            });
          } else {
            (dbAdmin instanceof AstraDbAdmin) && await spec.generateEventAstra(dbAdmin, key).catch((e) => {
              if (e instanceof assert.AssertionError) throw e;
            });
            (dbAdmin instanceof DataAPIDbAdmin) && await spec.generateEventDAPI(dbAdmin, key).catch((e) => {
              if (e instanceof assert.AssertionError) throw e;
            });
          }
        }

        assert.strictEqual(emissions.length, cfg.times);
        assert.strictEqual(emissions.length, new Set(emissions.map(e => e.requestId)).size);

        for (const e of emissions) {
          spec.validateEvent(dbAdmin, e);
          (dbAdmin instanceof AstraDbAdmin) ? spec.validateEventAstra?.(dbAdmin, e) : spec.validateEventDAPI?.(dbAdmin, e);

          assert.strictEqual(e.name, spec.eventName[0].toUpperCase() + spec.eventName.slice(1));
          assert.strictEqual(e.requestParams, undefined);
        }

        emissions.length = 0;
      }
    });
  };

  const DevopsApiEndpoint = DEFAULT_DEVOPS_API_ENDPOINTS[extractAstraEnvironment(TEST_APPLICATION_URI)];

  defineEventsTest('should emit adminCommandStarted events', {
    eventName: 'adminCommandStarted',
    async generateEvent(dbAdmin) {
      await dbAdmin.listKeyspaces();
    },
    validateEvent(_, e) {
      assert.ok(e instanceof AdminCommandStartedEvent);
      assert.strictEqual(e.getMessage(), '');
      assert.match(e.getMessagePrefix(), /^\(dbAdmin\.listKeyspaces\) GET http\S+$/);
    },
    validateEventAstra(dbAdmin, e) {
      assert.strictEqual(e.url, DevopsApiEndpoint + '/databases/' + dbAdmin.id);
    },
  });

  defineEventsTest('should emit adminCommandSucceeded events', {
    eventName: 'adminCommandSucceeded',
    async generateEvent(dbAdmin) {
      await dbAdmin.listKeyspaces();
    },
    validateEvent(_, e) {
      assert.ok(e instanceof AdminCommandSucceededEvent);
      assert.match(e.getMessage(), /^\(\d+ms\)$/);
      assert.match(e.getMessagePrefix(),  /^\(dbAdmin\.listKeyspaces\) GET http\S+$/);
    },
    validateEventAstra(dbAdmin, e) {
      assert.strictEqual(e.url, DevopsApiEndpoint + '/databases/' + dbAdmin.id);
    },
  });

  defineEventsTest('should emit adminCommandFailed events', {
    eventName: 'adminCommandFailed',
    async generateEvent(dbAdmin) {
      await dbAdmin.createKeyspace('!@*&($!(@');
    },
    validateEvent(_, e) {
      assert.ok(e instanceof AdminCommandFailedEvent);
      assert.match(e.getMessage(), /^\(\d+ms\) ERROR: [^\n]/);
      assert.match(e.getMessagePrefix(),  /^\(dbAdmin\.createKeyspace\) POST http\S+$/);
    },
    validateEventAstra(dbAdmin, e) {
      assert.strictEqual(e.url, DevopsApiEndpoint + '/databases/' + dbAdmin.id + '/keyspaces/!@*&($!(@');
    },
  });

  defineEventsTest('should emit adminCommandWarnings events', {
    eventName: 'adminCommandWarnings',
    async generateEvent(dbAdmin: DbAdmin) {
      const httpClient = dbAdmin['_getDataAPIHttpClient']();
      await httpClient.executeCommand({ findNamespaces: {} }, { keyspace: null, methodName: 'dbAdmin.xyz', timeoutManager: httpClient.tm.single('generalMethodTimeoutMs', {}) });
    },
    validateEvent(dbAdmin, e) {
      assert.ok(e instanceof AdminCommandWarningsEvent);
      assert.strictEqual(e.url, dbAdmin.db().endpoint + '/api/json/v1');
      assert.match(e.getMessage(), /^\{"findNamespaces":\{}} WARNINGS: .*/);
      assert.match(e.getMessagePrefix(), /^\(dbAdmin\.xyz\) POST http\S+$/);
    },
  });

  // TODO
  // defineEventsTest('should emit adminCommandPolling events', {
  //   eventName: 'adminCommandPolling',
  //   async generateEventAstra(dbAdmin) {
  //     await dbAdmin.createKeyspace('slania');
  //   },
  //   async generateEventDAPI(dbAdmin) {
  //
  //   },
  //   validateEvent(_, e) {
  //     assert.ok(e instanceof AdminCommandPollingEvent);
  //   },
  // });
});
