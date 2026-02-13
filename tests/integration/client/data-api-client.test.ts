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

import { DataAPIClient } from '@/src/client/index.js';
import assert from 'assert';
import { CommandFailedEvent, CommandStartedEvent, CommandSucceededEvent } from '@/src/documents/events.js';
import {
  Cfg,
  describe,
  it,
  parallel,
} from '@/tests/testlib/index.js';
import { DataAPIResponseError, DataAPITimeoutError, UUID } from '@/src/documents/index.js';
import { DEFAULT_KEYSPACE } from '@/src/lib/api/index.js';
import { DEFAULT_DATA_API_PATHS } from '@/src/lib/api/constants.js';
import { before } from 'mocha';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts.js';

describe('integration.client.data-api-client', () => {
  parallel('db', () => {
    it('properly connects to a db by endpoint', async () => {
      const client = new DataAPIClient(Cfg.DbToken, { environment: Cfg.DbEnvironment });
      const db = client.db(Cfg.DbUrl, { keyspace: DEFAULT_KEYSPACE });
      const collections = await db.listCollections();
      assert.ok(Array.isArray(collections));
    });

    it('lets Data API deal with throwing missing token error', async () => {
      const db = new DataAPIClient({ environment: Cfg.DbEnvironment }).db(Cfg.DbUrl, { keyspace: DEFAULT_KEYSPACE });
      await assert.rejects(() => db.listCollections(), DataAPIResponseError);
    });
  });

  describe('close', () => {
    it('should not allow operations after closing the client', async () => {
      const client = new DataAPIClient(Cfg.DbToken, { environment: Cfg.DbEnvironment });
      const db = client.db(Cfg.DbUrl, { keyspace: DEFAULT_KEYSPACE });
      await client.close();

      try {
        await db.listCollections();
        assert.fail('should have thrown an error');
      } catch (e) {
        assert.ok(e instanceof Error);
        assert.ok(e.name !== 'AssertionError');
      }
    });
  });

  describe('monitoring commands', () => {
    let stdout: string[] = [], stderr: string[] = [];
    const _console = global.console;

    before(() => {
      global.console = {
        log: (msg: string) => {
          stdout.push(msg);
        },
        error: (msg: string) => {
          stderr.push(msg);
        },
      } as Console;
    });

    after(() => {
      global.console = _console;
    });

    it('should not emit any command events when not enabled', async () => {
      for (const conf of [undefined, [], [{ events: 'all', emits: [] }]]) {
        stdout = []; stderr = [];

        const client = new DataAPIClient(Cfg.DbToken, { logging: conf as any, environment: Cfg.DbEnvironment });
        const db = client.db(Cfg.DbUrl, { keyspace: DEFAULT_KEYSPACE });
        const collection = db.collection(Cfg.DefaultCollectionName);

        client.on('commandStarted', () => assert.fail('should not have emitted commandStarted event'));
        client.on('commandSucceeded', () => assert.fail('should not have emitted commandSucceeded event'));
        client.on('commandFailed', () => assert.fail('should not have emitted commandFailed event'));

        await collection.insertOne({ _id: UUID.v4() });
        assert.deepStrictEqual(stdout, []);
        assert.deepStrictEqual(stderr, []);
      }
    });

    it('should allow cross-collections monitoring of successful commands when enabled', async () => {
      const client = new DataAPIClient(Cfg.DbToken, { logging: ['all', { events: 'commandSucceeded', emits: ['event', 'stdout'] }], environment: Cfg.DbEnvironment });
      const db = client.db(Cfg.DbUrl, { keyspace: DEFAULT_KEYSPACE });
      const collection1 = db.collection(Cfg.DefaultCollectionName);
      const collection2 = db.collection(Cfg.DefaultCollectionName, { keyspace: Cfg.OtherKeyspace });

      const startedEvents: CommandStartedEvent[] = [];
      const succeededEvents: CommandSucceededEvent[] = [];

      stdout = []; stderr = [];

      client.on('commandStarted', (event) => {
        startedEvents.push(event);
      });

      client.on('commandSucceeded', (event) => {
        succeededEvents.push(event);
      });

      client.on('commandFailed', () => {
        assert.fail('should not have emitted commandFailed event');
      });

      await collection1.insertOne({ name: 'Chthonic' });
      await collection2.deleteOne({ name: 'Chthonic' }, { timeout: 10000 });

      assert.ok(startedEvents[0] instanceof CommandStartedEvent);
      assert.ok(succeededEvents[0] instanceof CommandSucceededEvent);
      assert.ok(startedEvents[1] instanceof CommandStartedEvent);
      assert.ok(succeededEvents[1] instanceof CommandSucceededEvent);

      assert.strictEqual(startedEvents[0].commandName, 'insertOne');
      assert.strictEqual(succeededEvents[0].commandName, 'insertOne');
      assert.strictEqual(startedEvents[1].commandName, 'deleteOne');
      assert.strictEqual(succeededEvents[1].commandName, 'deleteOne');

      assert.strictEqual(startedEvents[0].target.keyspace, Cfg.DefaultKeyspace);
      assert.strictEqual(succeededEvents[0].target.keyspace, Cfg.DefaultKeyspace);
      assert.strictEqual(startedEvents[1].target.keyspace, Cfg.OtherKeyspace);
      assert.strictEqual(succeededEvents[1].target.keyspace, Cfg.OtherKeyspace);

      assert.strictEqual(startedEvents[0].target.collection, Cfg.DefaultCollectionName);
      assert.strictEqual(succeededEvents[0].target.collection, Cfg.DefaultCollectionName);
      assert.strictEqual(startedEvents[1].target.collection, Cfg.DefaultCollectionName);
      assert.strictEqual(succeededEvents[1].target.collection, Cfg.DefaultCollectionName);

      assert.strictEqual(startedEvents[0].target.url, `${Cfg.DbUrl}/${DEFAULT_DATA_API_PATHS[Cfg.DbEnvironment]}/${Cfg.DefaultKeyspace}/${Cfg.DefaultCollectionName}`);
      assert.strictEqual(succeededEvents[0].target.url, `${Cfg.DbUrl}/${DEFAULT_DATA_API_PATHS[Cfg.DbEnvironment]}/${Cfg.DefaultKeyspace}/${Cfg.DefaultCollectionName}`);
      assert.strictEqual(startedEvents[1].target.url, `${Cfg.DbUrl}/${DEFAULT_DATA_API_PATHS[Cfg.DbEnvironment]}/${Cfg.OtherKeyspace}/${Cfg.DefaultCollectionName}`);
      assert.strictEqual(succeededEvents[1].target.url, `${Cfg.DbUrl}/${DEFAULT_DATA_API_PATHS[Cfg.DbEnvironment]}/${Cfg.OtherKeyspace}/${Cfg.DefaultCollectionName}`);

      assert.deepStrictEqual(startedEvents[0].timeout, { generalMethodTimeoutMs: Timeouts.Default.generalMethodTimeoutMs, requestTimeoutMs: Timeouts.Default.requestTimeoutMs });
      assert.ok(succeededEvents[0].duration > 0);
      assert.deepStrictEqual(startedEvents[1].timeout, { requestTimeoutMs: 10000, generalMethodTimeoutMs: 10000 });
      assert.ok(succeededEvents[1].duration > 0);

      assert.deepStrictEqual(startedEvents[0].command, { insertOne: { document: { name: 'Chthonic' } } });
      assert.deepStrictEqual(startedEvents[0].command, { insertOne: { document: { name: 'Chthonic' } } });
      assert.deepStrictEqual(startedEvents[1].command, { deleteOne: { filter: { name: 'Chthonic' } } });
      assert.deepStrictEqual(startedEvents[1].command, { deleteOne: { filter: { name: 'Chthonic' } } });

      assert.ok(succeededEvents[0].response?.status?.insertedIds instanceof Array);
      assert.ok(typeof succeededEvents[1].response?.status?.deletedCount === 'number');

      assert.deepStrictEqual(stdout[0].substring(19), succeededEvents[0].format().substring(19)); // chops off timestamp
      assert.deepStrictEqual(stdout[1].substring(19), succeededEvents[1].format().substring(19));
      assert.deepStrictEqual(stderr, []);
    });

    it('should allow monitoring of failed commands when enabled', async () => {
      const client = new DataAPIClient(Cfg.DbToken, { environment: Cfg.DbEnvironment });
      const db = client.db(Cfg.DbUrl, { logging: ['all', { events: 'commandSucceeded', emits: ['event', 'stdout'] }], keyspace: DEFAULT_KEYSPACE });
      const collection = db.collection(Cfg.DefaultCollectionName);

      let startedEvent: CommandStartedEvent | undefined;
      let failedEvent: CommandFailedEvent | undefined;

      await collection.insertOne({ _id: 0, name: 'Oasis' });

      stdout = []; stderr = [];

      client.on('commandStarted', (event) => {
        startedEvent = event;
      });

      client.on('commandSucceeded', () => {
        assert.fail('should not have emitted commandSucceeded event');
      });

      client.on('commandFailed', (event) => {
        failedEvent = event;
      });

      try {
        await collection.insertOne({ _id: 0, name: 'Oasis' });
        assert.fail('should have thrown an error');
      } catch (e) {
        assert.ok(e instanceof Error);
      }

      assert.ok(startedEvent instanceof CommandStartedEvent);
      assert.ok(failedEvent instanceof CommandFailedEvent);

      assert.strictEqual(startedEvent.commandName, 'insertOne');
      assert.strictEqual(failedEvent.commandName, 'insertOne');

      assert.strictEqual(startedEvent.target.keyspace, DEFAULT_KEYSPACE);
      assert.strictEqual(failedEvent.target.keyspace, DEFAULT_KEYSPACE);

      assert.strictEqual(startedEvent.target.collection, Cfg.DefaultCollectionName);
      assert.strictEqual(failedEvent.target.collection, Cfg.DefaultCollectionName);

      assert.strictEqual(startedEvent.target.url, `${Cfg.DbUrl}/${DEFAULT_DATA_API_PATHS[Cfg.DbEnvironment]}/${DEFAULT_KEYSPACE}/${Cfg.DefaultCollectionName}`);
      assert.strictEqual(failedEvent.target.url, `${Cfg.DbUrl}/${DEFAULT_DATA_API_PATHS[Cfg.DbEnvironment]}/${DEFAULT_KEYSPACE}/${Cfg.DefaultCollectionName}`);

      assert.deepStrictEqual(startedEvent.timeout, { generalMethodTimeoutMs: Timeouts.Default.generalMethodTimeoutMs, requestTimeoutMs: Timeouts.Default.requestTimeoutMs });
      assert.ok(failedEvent.duration > 0);

      assert.deepStrictEqual(startedEvent.command, { insertOne: { document: { _id: 0, name: 'Oasis' } } });
      assert.deepStrictEqual(failedEvent.command, { insertOne: { document: { _id: 0, name: 'Oasis' } } });

      assert.ok(failedEvent.error instanceof DataAPIResponseError);
      assert.strictEqual(failedEvent.error.errorDescriptors.length, 1);
      assert.strictEqual(failedEvent.error.errorDescriptors[0].errorCode, 'DOCUMENT_ALREADY_EXISTS');

      assert.deepStrictEqual(stdout, []);
      assert.deepStrictEqual(stderr[0].substring(19), failedEvent.format().substring(19)); // chops off timestamp
    });

    it('should allow monitoring of timed-out commands when enabled', async () => {
      const client = new DataAPIClient(Cfg.DbToken, { environment: Cfg.DbEnvironment });
      const db = client.db(Cfg.DbUrl, { logging: ['all', { events: 'commandStarted', emits: ['event', 'stderr'] }], keyspace: DEFAULT_KEYSPACE });
      const collection = db.collection(Cfg.DefaultCollectionName);

      let startedEvent: CommandStartedEvent | undefined;
      let failedEvent: CommandFailedEvent | undefined;

      stdout = []; stderr = [];

      client.on('commandStarted', (event) => {
        startedEvent = event;
      });

      client.on('commandSucceeded', () => {
        assert.fail('should not have emitted commandSucceeded event');
      });

      client.on('commandFailed', (event) => {
        failedEvent = event;
      });

      await assert.rejects(() => collection.insertOne({ name: 'Xandria' }, { timeout: 1 }));

      assert.ok(startedEvent instanceof CommandStartedEvent);
      assert.ok(failedEvent instanceof CommandFailedEvent);

      assert.strictEqual(startedEvent.commandName, 'insertOne');
      assert.strictEqual(failedEvent.commandName, 'insertOne');

      assert.strictEqual(startedEvent.target.keyspace, DEFAULT_KEYSPACE);
      assert.strictEqual(failedEvent.target.keyspace, DEFAULT_KEYSPACE);

      assert.strictEqual(startedEvent.target.collection, Cfg.DefaultCollectionName);
      assert.strictEqual(failedEvent.target.collection, Cfg.DefaultCollectionName);

      assert.strictEqual(startedEvent.target.url, `${Cfg.DbUrl}/${DEFAULT_DATA_API_PATHS[Cfg.DbEnvironment]}/${DEFAULT_KEYSPACE}/${Cfg.DefaultCollectionName}`);
      assert.strictEqual(failedEvent.target.url, `${Cfg.DbUrl}/${DEFAULT_DATA_API_PATHS[Cfg.DbEnvironment]}/${DEFAULT_KEYSPACE}/${Cfg.DefaultCollectionName}`);

      assert.deepStrictEqual(startedEvent.timeout, { generalMethodTimeoutMs: 1, requestTimeoutMs: 1 });
      assert.ok(failedEvent.duration > 0);

      assert.deepStrictEqual(startedEvent.command, { insertOne: { document: { name: 'Xandria' } } });
      assert.deepStrictEqual(failedEvent.command, { insertOne: { document: { name: 'Xandria' } } });

      assert.ok(failedEvent.error instanceof DataAPITimeoutError);
      assert.deepStrictEqual(failedEvent.error.timeout, { generalMethodTimeoutMs: 1, requestTimeoutMs: 1 });

      assert.deepStrictEqual(stdout, []);
      assert.deepStrictEqual(stderr[0].substring(19), startedEvent.format().substring(19)); // chops off timestamp
      assert.deepStrictEqual(stderr[1].substring(19), failedEvent.format().substring(19));
    });
  });
});
