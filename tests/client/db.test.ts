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
import { TEST_COLLECTION_NAME, testClient } from '@/tests/fixtures';
import { randAlphaNumeric } from '@ngneat/falso';
import { Client, Db } from '@/src/client/index';
import { HttpClient } from '@/src/api/index';
import { parseUri } from '@/src/client/utils';

describe('Astra TS Client - collections.Db', async () => {
  let astraClient: Client | null;
  let dbUri: string;
  let httpClient: HttpClient;

  before(async function () {
    if (testClient == null) {
      return this.skip();
    }

    astraClient = await testClient.new();

    if (astraClient === null) {
      return this.skip();
    }

    dbUri = testClient.uri;
    httpClient = astraClient['_httpClient'];
  });

  afterEach(async () => {
    const db = astraClient?.db();
    await db?.dropCollection(TEST_COLLECTION_NAME);
  });

  describe('Db initialization', () => {
    it('should initialize a Db', () => {
      const db = new Db(httpClient, 'test-db');
      assert.ok(db);
    });
  });

  describe('Db collection operations', () => {
    it('should initialize a Collection', () => {
      const db = new Db(httpClient, 'test-db');
      const collection = db.collection('test-collection');
      assert.ok(collection);
    });

    it('should create a Collection', async () => {
      const collectionName = TEST_COLLECTION_NAME;
      const db = new Db(httpClient, parseUri(dbUri).keyspaceName);
      const res = await db.createCollection(collectionName);
      assert.ok(res);
      assert.strictEqual(res.collectionName, collectionName);
      const res2 = await db.createCollection(collectionName);
      assert.ok(res2);
      assert.strictEqual(res2.collectionName, collectionName);
    });

    it('should drop a Collection', async () => {
      const db = new Db(httpClient, parseUri(dbUri).keyspaceName);
      const suffix = randAlphaNumeric({ length: 4 }).join('');
      await db.createCollection(`test_db_collection_${suffix}`);
      const res = await db.dropCollection(`test_db_collection_${suffix}`);
      assert.strictEqual(res, true);
    });
  });

  describe('Db listCollections', () => {
    const name = 'test_db_collection_' + randAlphaNumeric({ length: 4 }).join('');
    let db: Db;

    before(async function () {
      db = new Db(httpClient, parseUri(dbUri).keyspaceName);
      await db.createCollection(name, { vector: { dimension: 5, metric: 'cosine' } });
    });

    after(async function () {
      await db.dropCollection(name);
    });

    it('should return a list of just names of collections with nameOnly not set', async () => {
      const res = await db.listCollections();
      assert.ok(res?.some((collection) => collection.name === name && !collection.options));
    });

    it('should return a list of just names of collections with nameOnly set to true', async () => {
      const res = await db.listCollections({ nameOnly: true });
      // @ts-expect-error - nameOnly is set to true, so options should not be present
      assert.ok(res.some((collection) => collection.name === name && !collection.options));
    });

    it('should return a list of collection infos with nameOnly set to false', async () => {
      const res = await db.listCollections({ nameOnly: false });
      assert.ok(res.some((collection) => collection.name === name && collection.options.vector?.dimension === 5));
    });
  });

  describe('Db command', () => {
    it('should execute a db-level command', async () => {
      const resp = await astraClient!.db().command({ findCollections: {} });
      assert.strictEqual(resp.status?.data, undefined);
      assert.strictEqual(resp.status?.errors, undefined);
      assert.ok(resp.status?.collections instanceof Array);
    });

    it('should execute a collection-level command', async () => {
      await astraClient!.db().createCollection(TEST_COLLECTION_NAME);
      const resp = await astraClient!.db().command({ findOne: {} }, TEST_COLLECTION_NAME);
      assert.deepStrictEqual(resp, { status: undefined, data: { document: null }, errors: undefined });
    });
  });
});
