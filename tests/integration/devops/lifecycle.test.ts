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

import { assertTestsEnabled, initTestObjects } from '@/tests/fixtures';
import { DataAPIClient } from '@/src/client';
import assert from 'assert';
import { DevOpsAPIResponseError } from '@/src/devops';
import { DEFAULT_NAMESPACE, DEFAULT_TIMEOUT, HttpMethods } from '@/src/api';
import { TimeoutManager } from '@/src/api/timeout-managers';

describe('integration.devops.lifecycle', async () => {
  let client: DataAPIClient;

  before(async function () {
    assertTestsEnabled(this, 'ADMIN', 'LONG', 'PROD');

    [client] = await initTestObjects(this);

    const dbs = await client.admin().listDatabases();

    if (dbs.some(db => db.info.name === 'astra-test-db' && db.status !== 'TERMINATING')) {
      throw new Error('Database \'astra-test-db\' already exists, drop it to proceed w/ lifecycle test');
    }
  });

  it('[admin] works', async () => {
    try {
      const admin = client.admin();

      const asyncDbAdmin = await admin.createDatabase({
        name: 'astra-test-db',
        cloudProvider: 'GCP',
        region: 'us-east1',
        namespace: 'my_namespace',
      }, {
        blocking: false,
      });
      const asyncDb = asyncDbAdmin.db();

      {
        assert.ok(asyncDb.id);
        assert.ok(asyncDbAdmin.id);
        assert.strictEqual(asyncDb.namespace, 'my_namespace');
      }

      {
        const dbInfo = await asyncDbAdmin.info();
        assert.ok(['PENDING', 'INITIALIZING'].includes(dbInfo.status));
        assert.strictEqual(dbInfo.info.name, 'astra-test-db');
        assert.strictEqual(dbInfo.info.cloudProvider, 'GCP');
        assert.strictEqual(dbInfo.info.region, 'us-east1');
        assert.strictEqual(dbInfo.info.keyspace, 'my_namespace');
      }

      const monitoringAdmin = client.admin({ monitorCommands: true });
      let commandStartedEvent = false;
      let commandPollingEvent = false;
      let commandSucceededEvent = false;

      {
        client.on('adminCommandStarted', (event) => {
          commandStartedEvent = true;
          assert.strictEqual(event.path, '/databases');
          assert.strictEqual(event.method, HttpMethods.Post);
          assert.strictEqual(event.longRunning, true);
          assert.strictEqual(event.params, undefined);
          assert.strictEqual(event.timeout, 2147483647);
        });

        client.on('adminCommandPolling', (event) => {
          commandPollingEvent = true;
          assert.strictEqual(event.path, '/databases');
          assert.strictEqual(event.method, HttpMethods.Post);
          assert.strictEqual(event.longRunning, true)
          assert.strictEqual(event.params, undefined);
          assert.strictEqual(event.interval, 10000);
          assert.ok(event.elapsed > 0);
        });

        client.on('adminCommandSucceeded', (event) => {
          commandSucceededEvent = true;
          assert.strictEqual(event.path, '/databases');
          assert.strictEqual(event.method, HttpMethods.Post);
          assert.strictEqual(event.longRunning, true);
          assert.strictEqual(event.params, undefined);
          assert.ok(event.duration > 60000);
        });
      }

      const syncDbAdmin = await monitoringAdmin.createDatabase({
        name: 'astra-test-db',
        cloudProvider: 'GCP',
        region: 'us-east1',
      });
      const syncDb = syncDbAdmin.db();

      {
        client.removeAllListeners();
        assert.ok(commandStartedEvent);
        assert.ok(commandPollingEvent);
        assert.ok(commandSucceededEvent);
      }

      {
        assert.ok(syncDb.id);
        assert.ok(syncDbAdmin.id);
        assert.strictEqual(syncDb.namespace, DEFAULT_NAMESPACE);
      }

      {
        const dbInfo = await syncDb.info();
        assert.strictEqual(dbInfo.name, 'astra-test-db');
        assert.strictEqual(dbInfo.cloudProvider, 'GCP');
        assert.strictEqual(dbInfo.region, 'us-east1');
        assert.strictEqual(dbInfo.keyspace, DEFAULT_NAMESPACE);
      }

      {
        await asyncDbAdmin['_httpClient']['_awaitStatus'](asyncDb.id, null!, {
          target: 'ACTIVE',
          legalStates: ['PENDING', 'INITIALIZING'],
          defaultPollInterval: 10000,
          id: null!,
          options: undefined,
        }, new TimeoutManager(DEFAULT_TIMEOUT, () => new Error('Timeout')), 0);
      }

      for (const [dbAdmin, db, dbType] of [[syncDbAdmin, syncDb, 'sync'], [asyncDbAdmin, asyncDb, 'async']] as const) {
        const dbInfo = await dbAdmin.info();
        assert.strictEqual(dbInfo.status, 'ACTIVE');
        assert.strictEqual(dbInfo.info.name, 'astra-test-db');
        assert.strictEqual(dbInfo.info.cloudProvider, 'GCP');
        assert.strictEqual(dbInfo.info.region, 'us-east1');
        assert.strictEqual(dbInfo.info.keyspace, db.namespace);

        const collections1 = await db.listCollections({ nameOnly: true });
        assert.deepStrictEqual(collections1, [], `in ${dbType}`)

        const collection = await db.createCollection('test_collection');
        assert.ok(collection, `in ${dbType}`);
        assert.strictEqual(collection.collectionName, 'test_collection', `in ${dbType}`);
        assert.deepStrictEqual(await collection.options(), {}, `in ${dbType}`);

        const collections2 = await db.listCollections({ nameOnly: true });
        assert.deepStrictEqual(collections2, ['test_collection'], `in ${dbType}`);

        const dbs1 = await admin.listDatabases();
        assert.ok(dbs1.find(db => db.id === dbAdmin.id), `in ${dbType}`);

        const dbs2 = await admin.listDatabases({ include: 'ACTIVE' });
        assert.ok(dbs2.find(db => db.id === dbAdmin.id), `in ${dbType}`);

        const namespaces = await dbAdmin.listNamespaces();
        assert.deepStrictEqual(namespaces, [db.namespace], `in ${dbType}`);
      }

      {
        await asyncDbAdmin.createNamespace('other_namespace', { blocking: false });

        const fullDbInfo3 = await asyncDbAdmin.info();
        assert.strictEqual(fullDbInfo3.status, 'MAINTENANCE');
        assert.strictEqual(fullDbInfo3.info.keyspace, 'my_namespace');
        assert.strictEqual(fullDbInfo3.info.additionalKeyspaces, undefined);
      }

      {
        await syncDbAdmin.createNamespace('other_namespace');
        await asyncDbAdmin['_httpClient']['_awaitStatus'](asyncDb.id, null!, {
          target: 'ACTIVE',
          legalStates: ['MAINTENANCE'],
          defaultPollInterval: 1000,
          id: null!,
          options: undefined,
        }, new TimeoutManager(DEFAULT_TIMEOUT, () => new Error('Timeout')), 0);
      }

      for (const [dbAdmin, db, dbType] of [[syncDbAdmin, syncDb, 'sync'], [asyncDbAdmin, asyncDb, 'async']] as const) {
        const namespaces2 = await dbAdmin.listNamespaces();
        assert.deepStrictEqual(namespaces2, [db.namespace, 'other_namespace'], `in ${dbType}`);
      }

      {
        await asyncDbAdmin.dropNamespace('other_namespace', { blocking: false });

        const fullDbInfo4 = await asyncDbAdmin.info();
        assert.strictEqual(fullDbInfo4.status, 'MAINTENANCE');
        assert.strictEqual(fullDbInfo4.info.keyspace, 'my_namespace');
        assert.deepStrictEqual(fullDbInfo4.info.additionalKeyspaces, ['other_namespace']);
      }

      {
        await syncDbAdmin.dropNamespace('other_namespace', { blocking: true });
        await asyncDbAdmin['_httpClient']['_awaitStatus'](asyncDb.id, null!, {
          target: 'ACTIVE',
          legalStates: ['MAINTENANCE'],
          defaultPollInterval: 1000,
          id: null!,
          options: undefined,
        }, new TimeoutManager(DEFAULT_TIMEOUT, () => new Error('Timeout')), 0);
      }

      for (const [dbAdmin, db, dbType] of [[syncDbAdmin, syncDb, 'sync'], [asyncDbAdmin, asyncDb, 'async']] as const) {
        const dbInfo = await dbAdmin.info();
        assert.strictEqual(dbInfo.status, 'ACTIVE');
        assert.strictEqual(dbInfo.info.keyspace, db.namespace);
        assert.strictEqual(dbInfo.info.additionalKeyspaces, undefined);

        const namespaces3 = await dbAdmin.listNamespaces();
        assert.deepStrictEqual(namespaces3, [db.namespace], `in ${dbType}`);
      }

      {
        await asyncDbAdmin.drop({ blocking: false });
        const dbInfo = await asyncDbAdmin.info();
        assert.strictEqual(dbInfo.status, 'TERMINATING');
      }

      {
        await admin.dropDatabase(syncDb);
        await asyncDbAdmin['_httpClient']['_awaitStatus'](asyncDb.id, null!, {
          target: 'TERMINATED',
          legalStates: ['TERMINATING'],
          defaultPollInterval: 10000,
          id: null!,
          options: undefined,
        }, new TimeoutManager(DEFAULT_TIMEOUT, () => new Error('Timeout')), 0);
      }

      for (const [dbAdmin, dbType] of [[syncDbAdmin, 'sync'], [asyncDbAdmin, 'async']] as const) {
        const dbs3 = await admin.listDatabases();
        assert.ok(!dbs3.find(db => db.id === dbAdmin.id), `in ${dbType}`);
      }

      {
        await assert.rejects(async () => await admin.dropDatabase(syncDb.id), DevOpsAPIResponseError);
        await assert.rejects(async () => await admin.dropDatabase(syncDb.id, { blocking: false }), DevOpsAPIResponseError);
        await assert.rejects(async () => await admin.dropDatabase(syncDb), DevOpsAPIResponseError);
        await assert.rejects(async () => await admin.dropDatabase(syncDb, { blocking: false }), DevOpsAPIResponseError);
        await assert.rejects(async () => await syncDbAdmin.drop(), DevOpsAPIResponseError);
        await assert.rejects(async () => await syncDbAdmin.drop({ blocking: false }), DevOpsAPIResponseError);
      }

      // Either this stops occasionally 500s in the following tests,
      // or I'm having a severe case of the Placebo effect
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.error(e);
      assert.fail('An error occurred during the lifecycle test');
    }
  }).timeout(0);
});
