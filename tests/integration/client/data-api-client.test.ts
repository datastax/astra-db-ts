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

import { DataAPIClient } from '@/src/client';
import assert from 'assert';
import { CommandFailedEvent, CommandStartedEvent, CommandSucceededEvent } from '@/src/documents/events';
import {
  DEFAULT_COLLECTION_NAME,
  describe,
  ENVIRONMENT,
  it,
  OTHER_KEYSPACE,
  parallel,
  TEST_APPLICATION_TOKEN,
  TEST_APPLICATION_URI,
} from '@/tests/testlib';
import { DataAPIResponseError, DataAPITimeoutError } from '@/src/documents';
import { DEFAULT_KEYSPACE } from '@/src/lib/api';
import { DEFAULT_DATA_API_PATHS, DEFAULT_TIMEOUT } from '@/src/lib/api/constants';

describe('integration.client.documents-client', () => {
  parallel('db', () => {
    it('properly connects to a db by endpoint', async () => {
      const client = new DataAPIClient(TEST_APPLICATION_TOKEN, { environment: ENVIRONMENT });
      const db = client.db(TEST_APPLICATION_URI, { keyspace: DEFAULT_KEYSPACE });
      const collections = await db.listCollections();
      assert.ok(Array.isArray(collections));
    });

    it('lets Data API deal with throwing missing token error', async () => {
      const db = new DataAPIClient({ environment: ENVIRONMENT }).db(TEST_APPLICATION_URI, { keyspace: DEFAULT_KEYSPACE });
      await assert.rejects(() => db.listCollections(), { message: 'Role unauthorized for operation: Missing token, expecting one in the Token header.' });
    });
  });

  describe('close', () => {
    it('should not allow operations after closing the client', async () => {
      const client = new DataAPIClient(TEST_APPLICATION_TOKEN, { environment: ENVIRONMENT });
      const db = client.db(TEST_APPLICATION_URI, { keyspace: DEFAULT_KEYSPACE });
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

  describe('asyncDispose', () => {
    it('should not allow operations after using the client', async () => {
      const client = new DataAPIClient(TEST_APPLICATION_TOKEN, { environment: ENVIRONMENT });
      const db = client.db(TEST_APPLICATION_URI, { keyspace: DEFAULT_KEYSPACE });

      {
        await using _client = client;
      }

      try {
        await db.listCollections();
        assert.fail('should have thrown an error');
      } catch (e) {
        assert.ok(e instanceof Error);
        assert.ok(e.name !== 'AssertionError');
      }
    });
  });

  parallel('monitoring commands', () => {
    it('should not emit any command events when not enabled', async () => {
      const client = new DataAPIClient(TEST_APPLICATION_TOKEN, { environment: ENVIRONMENT });
      const db = client.db(TEST_APPLICATION_URI, { keyspace: DEFAULT_KEYSPACE });
      const collection = db.collection(DEFAULT_COLLECTION_NAME);

      client.on('commandStarted', () => assert.fail('should not have emitted commandStarted event'));
      client.on('commandSucceeded', () => assert.fail('should not have emitted commandSucceeded event'));
      client.on('commandFailed', () => assert.fail('should not have emitted commandFailed event'));

      await collection.insertOne({ _id: 'Lordi' });
    });

    it('should not emit any command events when set to false', async () => {
      const client = new DataAPIClient(TEST_APPLICATION_TOKEN, { dbOptions: { monitorCommands: false }, environment: ENVIRONMENT });
      const db = client.db(TEST_APPLICATION_URI, { keyspace: DEFAULT_KEYSPACE });
      const collection = db.collection(DEFAULT_COLLECTION_NAME);

      client.on('commandStarted', () => assert.fail('should not have emitted commandStarted event'));
      client.on('commandSucceeded', () => assert.fail('should not have emitted commandSucceeded event'));
      client.on('commandFailed', () => assert.fail('should not have emitted commandFailed event'));

      await collection.insertOne({ _id: 'TRiDENT' });
    });

    it('should allow cross-collections monitoring of successful commands when enabled', async () => {
      const client = new DataAPIClient(TEST_APPLICATION_TOKEN, { dbOptions: { monitorCommands: true }, environment: ENVIRONMENT });
      const db = client.db(TEST_APPLICATION_URI, { keyspace: DEFAULT_KEYSPACE });
      const collection1 = db.collection(DEFAULT_COLLECTION_NAME);
      const collection2 = db.collection(DEFAULT_COLLECTION_NAME, { keyspace: OTHER_KEYSPACE });

      const startedEvents: CommandStartedEvent[] = [];
      const succeededEvents: CommandSucceededEvent[] = [];

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
      await collection2.deleteOne({ name: 'Chthonic' }, { maxTimeMS: 10000 });

      assert.ok(startedEvents[0] instanceof CommandStartedEvent);
      assert.ok(succeededEvents[0] instanceof CommandSucceededEvent);
      assert.ok(startedEvents[1] instanceof CommandStartedEvent);
      assert.ok(succeededEvents[1] instanceof CommandSucceededEvent);

      assert.strictEqual(startedEvents[0].commandName, 'insertOne');
      assert.strictEqual(succeededEvents[0].commandName, 'insertOne');
      assert.strictEqual(startedEvents[1].commandName, 'deleteOne');
      assert.strictEqual(succeededEvents[1].commandName, 'deleteOne');

      assert.strictEqual(startedEvents[0].keyspace, DEFAULT_KEYSPACE);
      assert.strictEqual(succeededEvents[0].keyspace, DEFAULT_KEYSPACE);
      assert.strictEqual(startedEvents[1].keyspace, OTHER_KEYSPACE);
      assert.strictEqual(succeededEvents[1].keyspace, OTHER_KEYSPACE);

      assert.strictEqual(startedEvents[0].collection, DEFAULT_COLLECTION_NAME);
      assert.strictEqual(succeededEvents[0].collection, DEFAULT_COLLECTION_NAME);
      assert.strictEqual(startedEvents[1].collection, DEFAULT_COLLECTION_NAME);
      assert.strictEqual(succeededEvents[1].collection, DEFAULT_COLLECTION_NAME);

      assert.strictEqual(startedEvents[0].url, `${TEST_APPLICATION_URI}/${DEFAULT_DATA_API_PATHS[ENVIRONMENT]}/${DEFAULT_KEYSPACE}/${DEFAULT_COLLECTION_NAME}`);
      assert.strictEqual(succeededEvents[0].url, `${TEST_APPLICATION_URI}/${DEFAULT_DATA_API_PATHS[ENVIRONMENT]}/${DEFAULT_KEYSPACE}/${DEFAULT_COLLECTION_NAME}`);
      assert.strictEqual(startedEvents[1].url, `${TEST_APPLICATION_URI}/${DEFAULT_DATA_API_PATHS[ENVIRONMENT]}/${OTHER_KEYSPACE}/${DEFAULT_COLLECTION_NAME}`);
      assert.strictEqual(succeededEvents[1].url, `${TEST_APPLICATION_URI}/${DEFAULT_DATA_API_PATHS[ENVIRONMENT]}/${OTHER_KEYSPACE}/${DEFAULT_COLLECTION_NAME}`);

      assert.strictEqual(startedEvents[0].timeout, DEFAULT_TIMEOUT);
      assert.ok(succeededEvents[0].duration > 0);
      assert.strictEqual(startedEvents[1].timeout, 10000);
      assert.ok(succeededEvents[1].duration > 0);

      assert.deepStrictEqual(startedEvents[0].command, { insertOne: { document: { name: 'Chthonic' } } });
      assert.deepStrictEqual(startedEvents[0].command, { insertOne: { document: { name: 'Chthonic' } } });
      assert.deepStrictEqual(startedEvents[1].command, { deleteOne: { filter: { name: 'Chthonic' } } });
      assert.deepStrictEqual(startedEvents[1].command, { deleteOne: { filter: { name: 'Chthonic' } } });

      assert.ok(succeededEvents[0].resp?.status?.insertedIds instanceof Array);
      assert.ok(typeof succeededEvents[1].resp?.status?.deletedCount === 'number');
    });

    it('should allow monitoring of failed commands when enabled', async () => {
      const client = new DataAPIClient(TEST_APPLICATION_TOKEN, { environment: ENVIRONMENT });
      const db = client.db(TEST_APPLICATION_URI, { monitorCommands: true, keyspace: DEFAULT_KEYSPACE });
      const collection = db.collection(DEFAULT_COLLECTION_NAME);

      let startedEvent: CommandStartedEvent | undefined;
      let failedEvent: CommandFailedEvent | undefined;

      await collection.insertOne({ _id: 0, name: 'Oasis' });

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

      assert.strictEqual(startedEvent.keyspace, DEFAULT_KEYSPACE);
      assert.strictEqual(failedEvent.keyspace, DEFAULT_KEYSPACE);

      assert.strictEqual(startedEvent.collection, DEFAULT_COLLECTION_NAME);
      assert.strictEqual(failedEvent.collection, DEFAULT_COLLECTION_NAME);

      assert.strictEqual(startedEvent.url, `${TEST_APPLICATION_URI}/${DEFAULT_DATA_API_PATHS[ENVIRONMENT]}/${DEFAULT_KEYSPACE}/${DEFAULT_COLLECTION_NAME}`);
      assert.strictEqual(failedEvent.url, `${TEST_APPLICATION_URI}/${DEFAULT_DATA_API_PATHS[ENVIRONMENT]}/${DEFAULT_KEYSPACE}/${DEFAULT_COLLECTION_NAME}`);

      assert.strictEqual(startedEvent.timeout, DEFAULT_TIMEOUT);
      assert.ok(failedEvent.duration > 0);

      assert.deepStrictEqual(startedEvent.command, { insertOne: { document: { _id: 0, name: 'Oasis' } } });
      assert.deepStrictEqual(failedEvent.command, { insertOne: { document: { _id: 0, name: 'Oasis' } } });

      assert.ok(failedEvent.error instanceof DataAPIResponseError);
      assert.strictEqual(failedEvent.error.errorDescriptors.length, 1);
      assert.strictEqual(failedEvent.error.errorDescriptors[0].errorCode, 'DOCUMENT_ALREADY_EXISTS');
    });

    it('should allow monitoring of timed-out commands when enabled', async () => {
      const client = new DataAPIClient(TEST_APPLICATION_TOKEN, { environment: ENVIRONMENT });
      const db = client.db(TEST_APPLICATION_URI, { monitorCommands: true, keyspace: DEFAULT_KEYSPACE });
      const collection = db.collection(DEFAULT_COLLECTION_NAME);

      let startedEvent: CommandStartedEvent | undefined;
      let failedEvent: CommandFailedEvent | undefined;

      client.on('commandStarted', (event) => {
        startedEvent = event;
      });

      client.on('commandSucceeded', () => {
        assert.fail('should not have emitted commandSucceeded event');
      });

      client.on('commandFailed', (event) => {
        failedEvent = event;
      });

      await assert.rejects(() => collection.insertOne({ name: 'Xandria' }, { maxTimeMS: 1 }));

      assert.ok(startedEvent instanceof CommandStartedEvent);
      assert.ok(failedEvent instanceof CommandFailedEvent);

      assert.strictEqual(startedEvent.commandName, 'insertOne');
      assert.strictEqual(failedEvent.commandName, 'insertOne');

      assert.strictEqual(startedEvent.keyspace, DEFAULT_KEYSPACE);
      assert.strictEqual(failedEvent.keyspace, DEFAULT_KEYSPACE);

      assert.strictEqual(startedEvent.collection, DEFAULT_COLLECTION_NAME);
      assert.strictEqual(failedEvent.collection, DEFAULT_COLLECTION_NAME);

      assert.strictEqual(startedEvent.url, `${TEST_APPLICATION_URI}/${DEFAULT_DATA_API_PATHS[ENVIRONMENT]}/${DEFAULT_KEYSPACE}/${DEFAULT_COLLECTION_NAME}`);
      assert.strictEqual(failedEvent.url, `${TEST_APPLICATION_URI}/${DEFAULT_DATA_API_PATHS[ENVIRONMENT]}/${DEFAULT_KEYSPACE}/${DEFAULT_COLLECTION_NAME}`);

      assert.strictEqual(startedEvent.timeout, 1);
      assert.ok(failedEvent.duration > 0);

      assert.deepStrictEqual(startedEvent.command, { insertOne: { document: { name: 'Xandria' } } });
      assert.deepStrictEqual(failedEvent.command, { insertOne: { document: { name: 'Xandria' } } });

      assert.ok(failedEvent.error instanceof DataAPITimeoutError);
      assert.strictEqual(failedEvent.error.timeout, 1);
    });
  });
});
