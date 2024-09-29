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
  DEFAULT_COLLECTION_NAME,
  describe,
  initTestObjects,
  it,
  OTHER_KEYSPACE,
  parallel,
  TEST_APPLICATION_TOKEN,
  TEST_APPLICATION_URI,
} from '@/tests/testlib';
import { DataAPIResponseError, UUID } from '@/src/documents';
import { DataAPIClient } from '@/src/client';
import { CollectionAlreadyExistsError, CollectionNotFoundError } from '@/src/db/errors';
import { DEFAULT_DATA_API_PATHS, DEFAULT_KEYSPACE } from '@/src/lib/api/constants';

parallel('integration.db', { dropEphemeral: 'after' }, ({ db }) => {
  describe('(LONG) createCollection', () => {
    it('should create a collection', async () => {
      const res = await db.createCollection('coll_1c', { indexing: { deny: ['*'] } });
      assert.ok(res);
      assert.strictEqual(res.collectionName, 'coll_1c');
      assert.strictEqual(res.keyspace, DEFAULT_KEYSPACE);
    });

    it('should create a collection in another keyspace', async () => {
      const res = await db.createCollection('coll_2c', { keyspace: OTHER_KEYSPACE });
      assert.ok(res);
      assert.strictEqual(res.collectionName, 'coll_2c');
      assert.strictEqual(res.keyspace, OTHER_KEYSPACE);
    });

    it('should throw CollectionAlreadyExistsError if collection already exists', async () => {
      await db.createCollection('coll_3c', { indexing: { deny: ['*'] } });
      try {
        await db.createCollection('coll_3c', { indexing: { deny: ['*'] } });
        assert.fail('Expected an error');
      } catch (e) {
        assert.ok(e instanceof CollectionAlreadyExistsError);
        assert.strictEqual(e.collectionName, 'coll_3c');
        assert.strictEqual(e.keyspace, DEFAULT_KEYSPACE);
      }
    });

    it('should create collection idempotently if checkExists is false', async () => {
      const res = await db.createCollection('coll_4c', { indexing: { deny: ['*'] } });
      assert.ok(res);
      assert.strictEqual(res.collectionName, 'coll_4c');
      const res2 = await db.createCollection('coll_4c', { checkExists: false, indexing: { deny: ['*'] } });
      assert.ok(res2);
      assert.strictEqual(res2.collectionName, 'coll_4c');
    });

    it('should create collection with same options idempotently if checkExists is false', async () => {
      const res = await db.createCollection('coll_5c', { indexing: { deny: ['*'] } });
      assert.ok(res);
      assert.strictEqual(res.collectionName, 'coll_5c');
      assert.strictEqual(res.keyspace, DEFAULT_KEYSPACE);
      const res2 = await db.createCollection('coll_5c', { indexing: { deny: ['*'] }, checkExists: false });
      assert.ok(res2);
      assert.strictEqual(res2.collectionName, 'coll_5c');
      assert.strictEqual(res2.keyspace, DEFAULT_KEYSPACE);
    });

    it('should fail creating collection with different options even if checkExists is false', async () => {
      const res = await db.createCollection('coll_6c', { indexing: { deny: ['*'] } });
      assert.ok(res);
      assert.strictEqual(res.collectionName, 'coll_6c');
      assert.strictEqual(res.keyspace, DEFAULT_KEYSPACE);
      try {
        await db.createCollection('coll_6c', { indexing: { allow: ['*'] }, checkExists: false });
        assert.fail('Expected an error');
      } catch (e) {
        assert.ok(e instanceof DataAPIResponseError);
      }
    });

    it('should create collection with different options in different keyspaces', async () => {
      const res = await db.createCollection('coll_7c', { indexing: { deny: ['*'] } });
      assert.ok(res);
      assert.strictEqual(res.collectionName, 'coll_7c');
      assert.strictEqual(res.keyspace, DEFAULT_KEYSPACE);
      const res2 = await db.createCollection('coll_7c', { indexing: { deny: ['*'] }, keyspace: OTHER_KEYSPACE });
      assert.ok(res2);
      assert.strictEqual(res2.collectionName, 'coll_7c');
      assert.strictEqual(res2.keyspace, OTHER_KEYSPACE);
    });

    it('(ASTRA) should work even when instantiated weirdly', async () => {
      const db = new DataAPIClient(TEST_APPLICATION_TOKEN, { dbOptions: { keyspace: '123123123', dataApiPath: 'King' } })
        .admin({ adminToken: 'dummy-token' })
        .dbAdmin(TEST_APPLICATION_URI, { dataApiPath: DEFAULT_DATA_API_PATHS['astra'], keyspace: DEFAULT_KEYSPACE })
        .db()
        .admin({ adminToken: 'tummy-token', endpointUrl: 'Memento Mori' })
        .db();

      const res = await db.createCollection('coll_8c', { indexing: { deny: ['*'] }, maxTimeMS: 60000 });
      assert.ok(res);
      assert.strictEqual(res.collectionName, 'coll_8c');
      assert.strictEqual(res.keyspace, DEFAULT_KEYSPACE);
    });
  });

  describe('(LONG) dropCollection', () => {
    it('should drop a collection', async () => {
      await db.createCollection('coll_1d', { indexing: { deny: ['*'] } });
      const res = await db.dropCollection('coll_1d');
      assert.strictEqual(res, true);
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === 'coll_1d');
      assert.strictEqual(collection, undefined);
    });

    it('should drop a collection using the collection method', async () => {
      const coll = await db.createCollection('coll_2d', { indexing: { deny: ['*'] } });
      const res = await coll.drop();
      assert.strictEqual(res, true);
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === 'coll_2d');
      assert.strictEqual(collection, undefined);
    });

    it('should drop a collection in non-default keyspace', async () => {
      await db.createCollection('coll_3d', { indexing: { deny: ['*'] }, keyspace: OTHER_KEYSPACE });
      const res = await db.dropCollection('coll_3d', { keyspace: OTHER_KEYSPACE });
      assert.strictEqual(res, true);
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === 'coll_3d');
      assert.strictEqual(collection, undefined);
    });

    it('should not drop a collection in different keyspace', async () => {
      await db.createCollection('coll_4d', { indexing: { deny: ['*'] } });
      const res = await db.dropCollection('coll_4d', { keyspace: OTHER_KEYSPACE });
      assert.strictEqual(res, true);
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === 'coll_4d');
      assert.ok(collection);
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
      assert.strictEqual(found.options.vector?.dimension, 5);
      assert.strictEqual(found.options.vector.metric, 'cosine');
    });

    it('should return a list of collection infos with nameOnly not set', async () => {
      const res = await db.listCollections();
      const found = res.find((collection) => collection.name === DEFAULT_COLLECTION_NAME);
      assert.ok(found);
      assert.strictEqual(found.options.vector?.dimension, 5);
      assert.strictEqual(found.options.vector.metric, 'cosine');
    });

    it('should not list collections in another keyspace', async () => {
      const res = await db.listCollections({ keyspace: OTHER_KEYSPACE });
      assert.strictEqual(res.length, 1);
    });
  });

  describe('command', () => {
    it('should execute a db-level command', async () => {
      const resp = await db.command({ findCollections: {} });
      assert.strictEqual(resp.status?.data, undefined);
      assert.strictEqual(resp.status?.errors, undefined);
      assert.ok(resp.status?.collections instanceof Array);
    });

    it('should execute a db-level command in different keyspace', async () => {
      const resp = await db.command({ findCollections: {} }, { keyspace: OTHER_KEYSPACE });
      assert.strictEqual(resp.status?.data, undefined);
      assert.strictEqual(resp.status?.errors, undefined);
      assert.ok(resp.status?.collections instanceof Array);
    });

    it('should execute a collection-level command', async () => {
      const uuid = UUID.v4();
      const collection = db.collection(DEFAULT_COLLECTION_NAME);
      await collection.insertOne({ _id: uuid });
      const resp = await db.command({ findOne: { filter: { _id: uuid } } }, { collection: DEFAULT_COLLECTION_NAME });
      assert.deepStrictEqual(resp, { status: undefined, data: { document: { _id: uuid } }, errors: undefined });
    });

    it('should execute a collection-level command in different keyspace', async () => {
      const uuid = UUID.v4();
      const collection = db.collection(DEFAULT_COLLECTION_NAME, { keyspace: OTHER_KEYSPACE });
      await collection.insertOne({ _id: uuid });
      const resp = await db.command({ findOne: { filter: { _id: uuid } } }, { collection: DEFAULT_COLLECTION_NAME, keyspace: OTHER_KEYSPACE });
      assert.deepStrictEqual(resp, { status: undefined, data: { document: { _id: uuid } }, errors: undefined });
    });

    it('should throw an error when performing collection-level command on non-existent collection', async () => {
      try {
        await db.command({ findOne: {} }, { collection: 'dasfsdaf' });
        assert.fail('Expected an error');
      } catch (e) {
        assert.ok(e instanceof CollectionNotFoundError);
      }
    });

    it('should throw an error if no keyspace set', async () => {
      const { db } = initTestObjects();
      db.useKeyspace(undefined!);
      await assert.rejects(() => db.command({ findEmbeddingProviders: {} }), { message: 'Db is missing a required keyspace; be sure to set one w/ client.db(..., { keyspace }), or db.useKeyspace()' });
    });

    it('should not throw an error if no keyspace set but keyspace: null', async () => {
      const { db } = initTestObjects();
      db.useKeyspace(undefined!);
      await assert.doesNotReject(() => db.command({ findEmbeddingProviders: {} }, { keyspace: null }));
    });
  });
});