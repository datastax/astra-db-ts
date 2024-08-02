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
import { DevOpsAPIResponseError } from '@/src/devops';
import { DEFAULT_NAMESPACE, HttpMethods } from '@/src/api';
import { TimeoutManager } from '@/src/api/timeout-managers';
import { background, it, TEMP_DB_NAME } from '@/tests/testlib';

background('[ADMIN] [LONG] [NOT-DEV] [ASTRA] integration.devops.lifecycle', ({ client }) => {
  it('works', async () => {
    for (const db of await client.admin().listDatabases()) {
      if (db.info.name === TEMP_DB_NAME && db.status !== 'TERMINATING') {
        void client.admin().dropDatabase(db.id, { maxTimeMS: 720000 });
      }
    }

    const admin = client.admin();

    const asyncDbAdmin = await admin.createDatabase({
      name: TEMP_DB_NAME,
      cloudProvider: 'GCP',
      region: 'us-east1',
      namespace: 'my_namespace',
    }, {
      blocking: false,
      maxTimeMS: 720000,
    });
    const asyncDb = asyncDbAdmin.db();

    {
      assert.ok(asyncDb.id);
      assert.ok(asyncDbAdmin.id);
      assert.strictEqual(asyncDb.namespace, 'my_namespace');
    }

    {
      const dbInfo1 = await asyncDbAdmin.info();
      assert.ok(['PENDING', 'INITIALIZING'].includes(dbInfo1.status));
      assert.strictEqual(dbInfo1.info.name, TEMP_DB_NAME);
      assert.strictEqual(dbInfo1.info.cloudProvider, 'GCP');
      assert.strictEqual(dbInfo1.info.region, 'us-east1');
      assert.strictEqual(dbInfo1.info.keyspace, 'my_namespace');

      const dbInfo2 = await admin.dbInfo(asyncDb.id);
      assert.deepStrictEqual(dbInfo1.info.name, dbInfo2.info.name);
      assert.deepStrictEqual(dbInfo1.info.keyspaces, dbInfo2.info.keyspaces);
      assert.ok(['PENDING', 'INITIALIZING'].includes(dbInfo2.status));
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
        assert.strictEqual(event.timeout, 720000);
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
      name: TEMP_DB_NAME,
      cloudProvider: 'GCP',
      region: 'us-east1',
    }, { maxTimeMS: 720000 });
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
      assert.strictEqual(dbInfo.name, TEMP_DB_NAME);
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
      }, new TimeoutManager(0, () => new Error('Timeout')), 0);
    }

    for (const [dbAdmin, db, dbType] of [[syncDbAdmin, syncDb, 'sync'], [asyncDbAdmin, asyncDb, 'async']] as const) {
      const dbInfo = await dbAdmin.info();
      assert.strictEqual(dbInfo.status, 'ACTIVE');
      assert.strictEqual(dbInfo.info.name, TEMP_DB_NAME);
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
      }, new TimeoutManager(0, () => new Error('Timeout')), 0);
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
      }, new TimeoutManager(0, () => new Error('Timeout')), 0);
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
      await admin.dropDatabase(syncDb, { maxTimeMS: 720000 });
      await asyncDbAdmin['_httpClient']['_awaitStatus'](asyncDb.id, null!, {
        target: 'TERMINATED',
        legalStates: ['TERMINATING'],
        defaultPollInterval: 10000,
        id: null!,
        options: undefined,
      }, new TimeoutManager(0, () => new Error('Timeout')), 0);
    }

    for (const [dbAdmin, dbType] of [[syncDbAdmin, 'sync'], [asyncDbAdmin, 'async']] as const) {
      const dbs3 = await admin.listDatabases();
      assert.ok(!dbs3.find(db => db.id === dbAdmin.id), `in ${dbType}`);
    }

    {
      await assert.rejects(async () => { await admin.dropDatabase(syncDb.id, { maxTimeMS: 720000 }); }, DevOpsAPIResponseError);
      await assert.rejects(async () => { await admin.dropDatabase(syncDb.id, { blocking: false, maxTimeMS: 720000 }); }, DevOpsAPIResponseError);
      await assert.rejects(async () => { await admin.dropDatabase(syncDb, { maxTimeMS: 720000 }); }, DevOpsAPIResponseError);
      await assert.rejects(async () => { await admin.dropDatabase(syncDb, { blocking: false, maxTimeMS: 720000 }); }, DevOpsAPIResponseError);
      await assert.rejects(async () => { await syncDbAdmin.drop(); }, DevOpsAPIResponseError);
      await assert.rejects(async () => { await syncDbAdmin.drop({ blocking: false }); }, DevOpsAPIResponseError);
    }

    // Either this stops occasional 500s in the following tests,
    // or I'm having a severe case of the Placebo effect
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
});
