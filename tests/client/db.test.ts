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

import assert from 'assert';
import { Db } from '@/src/client/db';
import { Client } from '@/src/client/client';
import { parseUri } from '@/src/client/utils';
import { TEST_COLLECTION_NAME, testClient } from '@/tests/fixtures';
import { randAlphaNumeric } from '@ngneat/falso';
import { HTTPClient } from '@/src/api';

describe("Astra TS Client - collections.Db", async () => {
  let astraClient: Client | null;
  let dbUri: string;
  let httpClient: HTTPClient;

  before(async function () {
    if (testClient == null) {
      return this.skip();
    }

    astraClient = await testClient.new();

    if (astraClient === null) {
      return this.skip();
    }

    dbUri = testClient.uri;
    httpClient = astraClient._httpClient;
  });

  afterEach(async () => {
    const db = astraClient?.db();
    await db?.dropCollection(TEST_COLLECTION_NAME);
  });

  describe("Db initialization", () => {
    it("should initialize a Db", () => {
      const db = new Db(httpClient, "test-db");
      assert.ok(db);
    });

    it("should not initialize a Db without a name", () => {
      let error: any;
      try {
        // @ts-expect-error - intentionally passing undefined for testing purposes
        const db = new Db(httpClient);
        assert.ok(db);
      } catch (e) {
        error = e;
      }
      assert.ok(error);
    });
  });

  describe("Db collection operations", () => {
    it("should initialize a Collection", () => {
      const db = new Db(httpClient, "test-db");
      const collection = db.collection("test-collection");
      assert.ok(collection);
    });

    it("should not initialize a Collection without a name", () => {
      let error: any;
      try {
        const db = new Db(httpClient, "test-db");
        // @ts-expect-error - intentionally passing undefined for testing purposes
        const collection = db.collection();
        assert.ok(collection);
      } catch (e) {
        error = e;
      }
      assert.ok(error);
    });

    it("should create a Collection", async () => {
      const collectionName = TEST_COLLECTION_NAME;
      const db = new Db(httpClient, parseUri(dbUri).keyspaceName);
      const res = await db.createCollection(collectionName);
      assert.ok(res);
      assert.strictEqual(res.collectionName, collectionName);
      const res2 = await db.createCollection(collectionName);
      assert.ok(res2);
      assert.strictEqual(res2.collectionName, collectionName);
    });

    it("should drop a Collection", async () => {
      const db = new Db(httpClient, parseUri(dbUri).keyspaceName);
      const suffix = randAlphaNumeric({ length: 4 }).join("");
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
      await db.createCollection(name, { vector: { dimension: 5 } });
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
      assert.ok(res.some((collection) => collection.name === name && collection.options));
    });
  });
});
