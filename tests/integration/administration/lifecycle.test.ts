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
import { DevOpsAPIResponseError } from '@/src/administration';
import { background, it, TEMP_DB_NAME } from '@/tests/testlib';
import { DEFAULT_KEYSPACE, HttpMethods } from '@/src/lib/api/constants';
import { buildAstraEndpoint } from '@/src/lib/utils';

background('(ADMIN) (LONG) (NOT-DEV) (ASTRA) integration.administration.lifecycle', ({ client }) => {
  it('works', async () => {
    const admin = client.admin();

    for (const db of await admin.listDatabases()) {
      if (db.name === TEMP_DB_NAME && db.status !== 'TERMINATING') {
        void admin.dropDatabase(db.id, { timeout: 720000 });
      }
    }

    const asyncDbAdmin = await admin.createDatabase({
      name: TEMP_DB_NAME,
      cloudProvider: 'GCP',
      region: 'us-east1',
      keyspace: 'my_keyspace',
    }, {
      blocking: false,
      timeout: 720000,
    });
    const asyncDb = asyncDbAdmin.db();

    {
      assert.ok(asyncDb.id);
      assert.ok(asyncDbAdmin.id);
      assert.strictEqual(asyncDb.keyspace, 'my_keyspace');
    }

    {
      const dbInfo1 = await asyncDbAdmin.info();
      assert.ok(['PENDING', 'INITIALIZING'].includes(dbInfo1.status));
      assert.strictEqual(dbInfo1.name, TEMP_DB_NAME);
      assert.strictEqual(dbInfo1.cloudProvider, 'GCP');
      assert.deepStrictEqual(dbInfo1.regions.length, 1);
      assert.deepStrictEqual({ ...dbInfo1.regions[0], createdAt: 0 }, { name: 'us-east1', apiEndpoint: buildAstraEndpoint(dbInfo1.id, 'us-east1'), createdAt: 0 });
      assert.ok(dbInfo1.regions[0].createdAt as unknown instanceof Date);
      assert.deepStrictEqual(dbInfo1.keyspaces, ['my_keyspace']);

      const dbInfo2 = await admin.dbInfo(asyncDb.id);
      assert.deepStrictEqual(dbInfo1.name, dbInfo2.name);
      assert.deepStrictEqual(dbInfo1.keyspaces, dbInfo2.keyspaces);
      assert.ok(['PENDING', 'INITIALIZING'].includes(dbInfo2.status));
    }

    const monitoringAdmin = client.admin();
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
        assert.deepStrictEqual(event.timeout, { databaseAdminTimeoutMs: 720000, requestTimeoutMs: 60000 });
      });

      client.on('adminCommandPolling', (event) => {
        commandPollingEvent = true;
        assert.strictEqual(event.path, '/databases');
        assert.strictEqual(event.method, HttpMethods.Post);
        assert.strictEqual(event.longRunning, true);
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
    }, { timeout: 720000 });
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
      assert.strictEqual(syncDb.keyspace, DEFAULT_KEYSPACE);
    }

    {
      const dbInfo = await syncDb.info();
      assert.strictEqual(dbInfo.name, TEMP_DB_NAME);
      assert.strictEqual(dbInfo.cloudProvider, 'GCP');
      assert.strictEqual(dbInfo.region, 'us-east1');
      assert.deepStrictEqual(dbInfo.keyspaces, [DEFAULT_KEYSPACE]);
    }

    {
      await asyncDbAdmin._httpClient['_awaitStatus'](asyncDb.id, {} as any, {
        target: 'ACTIVE',
        legalStates: ['PENDING', 'INITIALIZING'],
        defaultPollInterval: 10000,
        id: null!,
        options: undefined,
        timeoutManager: asyncDbAdmin._httpClient.tm.multipart('generalMethodTimeoutMs', { timeout: 0 }),
      }, 0);
    }

    for (const [dbAdmin, db, dbType] of [[syncDbAdmin, syncDb, 'sync'], [asyncDbAdmin, asyncDb, 'async']] as const) {
      const dbInfo = await dbAdmin.info();
      assert.strictEqual(dbInfo.status, 'ACTIVE');
      assert.strictEqual(dbInfo.name, TEMP_DB_NAME);
      assert.strictEqual(dbInfo.cloudProvider, 'GCP');
      assert.deepStrictEqual(dbInfo.regions.length, 1);
      assert.deepStrictEqual({ ...dbInfo.regions[0], createdAt: 0 }, { name: 'us-east1', apiEndpoint: buildAstraEndpoint(dbInfo.id, 'us-east1'), createdAt: 0 });
      assert.ok(dbInfo.regions[0].createdAt as unknown instanceof Date);
      assert.deepStrictEqual(dbInfo.keyspaces, [db.keyspace]);

      const collections1 = await db.listCollections({ nameOnly: true });
      assert.deepStrictEqual(collections1, [], `in ${dbType}`);

      const collection = await db.createCollection('test_collection');
      assert.ok(collection, `in ${dbType}`);
      assert.strictEqual(collection.name, 'test_collection', `in ${dbType}`);
      assert.deepStrictEqual(await collection.options(), {}, `in ${dbType}`);

      const collections2 = await db.listCollections({ nameOnly: true });
      assert.deepStrictEqual(collections2, ['test_collection'], `in ${dbType}`);

      const dbs1 = await admin.listDatabases();
      assert.ok(dbs1.find(db => db.id === dbAdmin.id), `in ${dbType}`);

      const dbs2 = await admin.listDatabases({ include: 'ACTIVE', provider: 'GCP', limit: 56 });
      assert.ok(dbs2.find(db => db.id === dbAdmin.id), `in ${dbType}`);

      const keyspaces = await dbAdmin.listKeyspaces();
      assert.deepStrictEqual(keyspaces, [db.keyspace], `in ${dbType}`);
    }

    {
      await asyncDbAdmin.createKeyspace('other_keyspace', { blocking: false });

      const fullDbInfo3 = await asyncDbAdmin.info();
      assert.strictEqual(fullDbInfo3.status, 'MAINTENANCE');
      assert.deepStrictEqual(fullDbInfo3.keyspaces, ['my_keyspace']);
    }

    {
      await syncDbAdmin.createKeyspace('other_keyspace');
      await asyncDbAdmin._httpClient['_awaitStatus'](asyncDb.id, {} as any, {
        target: 'ACTIVE',
        legalStates: ['MAINTENANCE'],
        defaultPollInterval: 1000,
        id: null!,
        options: undefined,
        timeoutManager: asyncDbAdmin._httpClient.tm.multipart('generalMethodTimeoutMs', { timeout: 0 }),
      }, 0);
    }

    for (const [dbAdmin, db, dbType] of [[syncDbAdmin, syncDb, 'sync'], [asyncDbAdmin, asyncDb, 'async']] as const) {
      const keyspaces2 = await dbAdmin.listKeyspaces();
      assert.deepStrictEqual(keyspaces2, [db.keyspace, 'other_keyspace'], `in ${dbType}`);
    }

    {
      await asyncDbAdmin.dropKeyspace('other_keyspace', { blocking: false });

      const fullDbInfo4 = await asyncDbAdmin.info();
      assert.strictEqual(fullDbInfo4.status, 'MAINTENANCE');
      assert.deepStrictEqual(fullDbInfo4.keyspaces, ['my_keyspace', 'other_keyspace']);
    }

    {
      await syncDbAdmin.dropKeyspace('other_keyspace', { blocking: true });
      await asyncDbAdmin._httpClient['_awaitStatus'](asyncDb.id, {} as any, {
        target: 'ACTIVE',
        legalStates: ['MAINTENANCE'],
        defaultPollInterval: 1000,
        id: null!,
        options: undefined,
        timeoutManager: asyncDbAdmin._httpClient.tm.multipart('generalMethodTimeoutMs', { timeout: 0 }),
      }, 0);
    }

    for (const [dbAdmin, db, dbType] of [[syncDbAdmin, syncDb, 'sync'], [asyncDbAdmin, asyncDb, 'async']] as const) {
      const dbInfo = await dbAdmin.info();
      assert.strictEqual(dbInfo.status, 'ACTIVE');
      assert.deepStrictEqual(dbInfo.keyspaces, [db.keyspace]);

      const keyspaces3 = await dbAdmin.listKeyspaces();
      assert.deepStrictEqual(keyspaces3, [db.keyspace], `in ${dbType}`);
    }

    {
      await asyncDbAdmin.drop({ blocking: false });
      const dbInfo = await asyncDbAdmin.info();
      assert.strictEqual(dbInfo.status, 'TERMINATING');
    }

    {
      await admin.dropDatabase(syncDb, { timeout: 720000 });
      await asyncDbAdmin._httpClient['_awaitStatus'](asyncDb.id, {} as any, {
        target: 'TERMINATED',
        legalStates: ['TERMINATING'],
        defaultPollInterval: 10000,
        id: null!,
        options: undefined,
        timeoutManager: asyncDbAdmin._httpClient.tm.multipart('generalMethodTimeoutMs', { timeout: 0 }),
      }, 0);
    }

    for (const [dbAdmin, dbType] of [[syncDbAdmin, 'sync'], [asyncDbAdmin, 'async']] as const) {
      const dbs3 = await admin.listDatabases();
      assert.ok(!dbs3.find(db => db.id === dbAdmin.id), `in ${dbType}`);
    }

    {
      await assert.rejects(async () => { await admin.dropDatabase(syncDb.id, { timeout: 720000 }); }, DevOpsAPIResponseError);
      await assert.rejects(async () => { await admin.dropDatabase(syncDb.id, { blocking: false, timeout: 720000 }); }, DevOpsAPIResponseError);
      await assert.rejects(async () => { await admin.dropDatabase(syncDb, { timeout: 720000 }); }, DevOpsAPIResponseError);
      await assert.rejects(async () => { await admin.dropDatabase(syncDb, { blocking: false, timeout: 720000 }); }, DevOpsAPIResponseError);
      await assert.rejects(async () => { await syncDbAdmin.drop(); }, DevOpsAPIResponseError);
      await assert.rejects(async () => { await syncDbAdmin.drop({ blocking: false }); }, DevOpsAPIResponseError);
    }

    // Either this stops occasional 500s in the following tests,
    // or I'm having a severe case of the Placebo effect
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
});
