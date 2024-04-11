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
import {
  assertTestsEnabled,
  DEFAULT_COLLECTION_NAME,
  EPHEMERAL_COLLECTION_NAME,
  initTestObjects,
  OTHER_NAMESPACE,
} from '@/tests/fixtures';
import { CollectionAlreadyExistsError, DataAPIResponseError, Db } from '@/src/data-api';
import { DEFAULT_DATA_API_PATH, DEFAULT_NAMESPACE } from '@/src/api';
import { DataAPIClient } from '@/src/client';
import process from 'process';
import { CollectionNotFoundError } from '@/src/data-api/errors';

describe('integration.data-api.db', async () => {
  let db: Db;

  before(async function () {
    [, db] = await initTestObjects(this);
    await db.dropCollection(EPHEMERAL_COLLECTION_NAME);
    await db.dropCollection(EPHEMERAL_COLLECTION_NAME, { namespace: OTHER_NAMESPACE });
  });

  describe('[long] createCollection + dropCollection', () => {
    before(async function () {
      assertTestsEnabled(this, 'LONG');
    });

    afterEach(async function () {
      await db.dropCollection(EPHEMERAL_COLLECTION_NAME);
      await db.dropCollection(EPHEMERAL_COLLECTION_NAME, { namespace: OTHER_NAMESPACE });
    });

    it('should create a collection', async () => {
      const res = await db.createCollection(EPHEMERAL_COLLECTION_NAME);
      assert.ok(res);
      assert.strictEqual(res.collectionName, EPHEMERAL_COLLECTION_NAME);
      assert.strictEqual(res.namespace, DEFAULT_NAMESPACE);
    });

    it('should create a collection in another namespace', async () => {
      const res = await db.createCollection(EPHEMERAL_COLLECTION_NAME, { namespace: OTHER_NAMESPACE });
      assert.ok(res);
      assert.strictEqual(res.collectionName, EPHEMERAL_COLLECTION_NAME);
      assert.strictEqual(res.namespace, OTHER_NAMESPACE);
    });

    it('should throw CollectionAlreadyExistsError if collection already exists', async () => {
      await db.createCollection(EPHEMERAL_COLLECTION_NAME);
      try {
        await db.createCollection(EPHEMERAL_COLLECTION_NAME);
        assert.fail('Expected an error');
      } catch (e) {
        assert.ok(e instanceof CollectionAlreadyExistsError);
        assert.strictEqual(e.collectionName, EPHEMERAL_COLLECTION_NAME);
        assert.strictEqual(e.namespace, DEFAULT_NAMESPACE);
      }
    });

    it('should create collection idempotently if checkExists is false', async () => {
      const res = await db.createCollection(EPHEMERAL_COLLECTION_NAME);
      assert.ok(res);
      assert.strictEqual(res.collectionName, EPHEMERAL_COLLECTION_NAME);
      const res2 = await db.createCollection(EPHEMERAL_COLLECTION_NAME, { checkExists: false });
      assert.ok(res2);
      assert.strictEqual(res2.collectionName, EPHEMERAL_COLLECTION_NAME);
    });

    it('should create collection with same options idempotently if checkExists is false', async () => {
      const res = await db.createCollection(EPHEMERAL_COLLECTION_NAME, { indexing: { deny: ['*'] } });
      assert.ok(res);
      assert.strictEqual(res.collectionName, EPHEMERAL_COLLECTION_NAME);
      assert.strictEqual(res.namespace, DEFAULT_NAMESPACE);
      const res2 = await db.createCollection(EPHEMERAL_COLLECTION_NAME, { indexing: { deny: ['*'] }, checkExists: false });
      assert.ok(res2);
      assert.strictEqual(res2.collectionName, EPHEMERAL_COLLECTION_NAME);
      assert.strictEqual(res2.namespace, DEFAULT_NAMESPACE);
    });

    it('should fail creating collection with different options even if checkExists is false', async () => {
      const res = await db.createCollection(EPHEMERAL_COLLECTION_NAME, { indexing: { deny: ['*'] } });
      assert.ok(res);
      assert.strictEqual(res.collectionName, EPHEMERAL_COLLECTION_NAME);
      assert.strictEqual(res.namespace, DEFAULT_NAMESPACE);
      try {
        await db.createCollection(EPHEMERAL_COLLECTION_NAME, { indexing: { allow: ['*'] }, checkExists: false });
        assert.fail('Expected an error');
      } catch (e) {
        assert.ok(e instanceof DataAPIResponseError);
      }
    });

    it('should create collection with different options in different namespaces', async () => {
      const res = await db.createCollection(EPHEMERAL_COLLECTION_NAME, { indexing: { deny: ['*'] } });
      assert.ok(res);
      assert.strictEqual(res.collectionName, EPHEMERAL_COLLECTION_NAME);
      assert.strictEqual(res.namespace, DEFAULT_NAMESPACE);
      const res2 = await db.createCollection(EPHEMERAL_COLLECTION_NAME, { indexing: { deny: ['*'] }, namespace: OTHER_NAMESPACE });
      assert.ok(res2);
      assert.strictEqual(res2.collectionName, EPHEMERAL_COLLECTION_NAME);
      assert.strictEqual(res2.namespace, OTHER_NAMESPACE);
    });

    it('should drop a collection', async () => {
      await db.createCollection(EPHEMERAL_COLLECTION_NAME);
      const res = await db.dropCollection(EPHEMERAL_COLLECTION_NAME);
      assert.strictEqual(res, true);
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === EPHEMERAL_COLLECTION_NAME);
      assert.strictEqual(collection, undefined);
    });

    it('should drop a collection in non-default namespace', async () => {
      await db.createCollection(EPHEMERAL_COLLECTION_NAME, { namespace: OTHER_NAMESPACE });
      const res = await db.dropCollection(EPHEMERAL_COLLECTION_NAME, { namespace: OTHER_NAMESPACE });
      assert.strictEqual(res, true);
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === EPHEMERAL_COLLECTION_NAME);
      assert.strictEqual(collection, undefined);
    });

    it('should not drop a collection in different namespace', async () => {
      await db.createCollection(EPHEMERAL_COLLECTION_NAME);
      const res = await db.dropCollection(EPHEMERAL_COLLECTION_NAME, { namespace: OTHER_NAMESPACE });
      assert.strictEqual(res, true);
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === EPHEMERAL_COLLECTION_NAME);
      assert.ok(collection);
    });

    it('should work even when instantiated weirdly', async () => {
      const db = new DataAPIClient(process.env.APPLICATION_TOKEN!, { dbOptions: { namespace: '123123123', dataApiPath: 'King, by Eluveitie' } })
        .admin({ adminToken: 'dummy-token' })
        .dbAdmin(process.env.ASTRA_URI!, { dataApiPath: DEFAULT_DATA_API_PATH, namespace: DEFAULT_NAMESPACE })
        .db()
        .admin({ adminToken: 'tummy-token', endpointUrl: 'Memento Mori, by Feuerschwanz' })
        .db();

      const res = await db.createCollection(EPHEMERAL_COLLECTION_NAME);
      assert.ok(res);
      assert.strictEqual(res.collectionName, EPHEMERAL_COLLECTION_NAME);
      assert.strictEqual(res.namespace, DEFAULT_NAMESPACE);
    });
  });

  describe('listCollections', () => {
    it('should return a list of just names of collections with nameOnly set to true', async () => {
      const res = await db.listCollections({ nameOnly: true });
      const found = res.find((collection) => collection === DEFAULT_COLLECTION_NAME);
      assert.ok(found);
    });

    it('should return a list of collection infos with nameOnly set to false', async () => {
      const res = await db.listCollections({ nameOnly: false });
      const found = res.find((collection) => collection.name === DEFAULT_COLLECTION_NAME);
      assert.ok(found);
      assert.strictEqual(found.options?.vector?.dimension, 5);
      assert.strictEqual(found.options?.vector?.metric, 'cosine');
    });

    it('should return a list of collection infos with nameOnly not set', async () => {
      const res = await db.listCollections();
      const found = res.find((collection) => collection.name === DEFAULT_COLLECTION_NAME);
      assert.ok(found);
      assert.strictEqual(found.options?.vector?.dimension, 5);
      assert.strictEqual(found.options?.vector?.metric, 'cosine');
    });

    it('should not list collections in another namespace', async () => {
      const res = await db.listCollections({ namespace: OTHER_NAMESPACE });
      assert.strictEqual(res.length, 1);
    });
  });

  describe('command', () => {
    afterEach(async function () {
      await db.dropCollection(EPHEMERAL_COLLECTION_NAME);
      await db.dropCollection(EPHEMERAL_COLLECTION_NAME, { namespace: OTHER_NAMESPACE });
    });

    it('should execute a db-level command', async () => {
      const resp = await db.command({ findCollections: {} });
      assert.strictEqual(resp.status?.data, undefined);
      assert.strictEqual(resp.status?.errors, undefined);
      assert.ok(resp.status?.collections instanceof Array);
    });

    it('should execute a db-level command in different namespace', async () => {
      const resp = await db.command({ findCollections: {} }, { namespace: OTHER_NAMESPACE });
      assert.strictEqual(resp.status?.data, undefined);
      assert.strictEqual(resp.status?.errors, undefined);
      assert.ok(resp.status?.collections instanceof Array);
    });

    it('should execute a collection-level command', async () => {
      const collection = db.collection(DEFAULT_COLLECTION_NAME);
      await collection.insertOne({ _id: 1 });
      const resp = await db.command({ findOne: {} }, { collection: DEFAULT_COLLECTION_NAME });
      assert.deepStrictEqual(resp, { status: undefined, data: { document: { _id: 1 } }, errors: undefined });
    });

    it('[long] should execute a collection-level command in different namespace', async function () {
      assertTestsEnabled(this, 'LONG');
      const collection = await db.createCollection(EPHEMERAL_COLLECTION_NAME, { namespace: OTHER_NAMESPACE });
      await collection.insertOne({ _id: 1 });
      const resp = await db.command({ findOne: {} }, { collection: EPHEMERAL_COLLECTION_NAME, namespace: OTHER_NAMESPACE });
      assert.deepStrictEqual(resp, { status: undefined, data: { document: { _id: 1 } }, errors: undefined });
      try {
        await db.command({ findOne: {} }, { collection: EPHEMERAL_COLLECTION_NAME });
        assert.fail('Expected an error');
      } catch (e) {
        assert.ok(e instanceof CollectionNotFoundError);
      }
    });
  });
});
