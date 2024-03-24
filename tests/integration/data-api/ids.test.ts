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
import { Collection, Db, ObjectId, UUID } from '@/src/data-api';
import { TEST_COLLECTION_NAME, testClient } from '@/tests/fixtures';

describe.skip('integration.data-api.ids tests', () => {
  let db: Db;

  before(async function() {
    if (testClient == null) {
      return this.skip();
    }

    [,db] = testClient.new();

    await db.dropCollection(TEST_COLLECTION_NAME);
  });

  describe('default', () => {
    let collection: Collection;

    before(async function () {
      collection = await db.createCollection(TEST_COLLECTION_NAME);
    });

    afterEach(async function () {
      await collection.deleteAll();
    });

    after(async function () {
      await db.dropCollection(TEST_COLLECTION_NAME);
    });

    it('is set in listCollections', async () => {
      const collections = await db.listCollections({ nameOnly: false });
      const collection = collections.find(c => c.name === TEST_COLLECTION_NAME);
      assert.ok(collection);
      assert.deepStrictEqual(collection.options, {});
    });

    it('sets it as the default id', async () => {
      console.log(await collection.insertOne({ name: 'test' }));
      const [found] = await collection.find({ name: 'test' }).toArray();
      const id = found._id;
      assert.ok(typeof <any>id === 'string');
      assert.doesNotThrow(() => new UUID(id));
    });
  });

  describe('uuid', () => {
    let collection: Collection;

    before(async function () {
      collection = await db.createCollection(TEST_COLLECTION_NAME, { defaultId: { type: 'uuid' } });
    });

    afterEach(async function () {
      await collection.deleteAll();
    });

    after(async function () {
      await db.dropCollection(TEST_COLLECTION_NAME);
    });

    it('is set in listCollections', async () => {
      const collections = await db.listCollections({ nameOnly: false });
      const collection = collections.find(c => c.name === TEST_COLLECTION_NAME);
      assert.ok(collection);
      assert.deepStrictEqual(collection.options, { defaultId: { type: 'uuid' } });
    });

    it('sets it as the default id', async () => {
      console.log(await collection.insertOne({ name: 'test' }));
      const [found] = await collection.find({ name: 'test' }).toArray();
      const id = found._id;
      assert.ok(<any>id instanceof UUID);
      assert.strictEqual(id.version, 4);
    });
  });

  describe('uuidv6', () => {
    let collection: Collection;

    before(async function () {
      collection = await db.createCollection(TEST_COLLECTION_NAME, { defaultId: { type: 'uuidv6' } });
    });

    afterEach(async function () {
      await collection.deleteAll();
    });

    after(async function () {
      await db.dropCollection(TEST_COLLECTION_NAME);
    });

    it('is set in listCollections', async () => {
      const collections = await db.listCollections({ nameOnly: false });
      const collection = collections.find(c => c.name === TEST_COLLECTION_NAME);
      assert.ok(collection);
      assert.deepStrictEqual(collection.options, { defaultId: { type: 'uuidv6' } });
    });

    it('sets it as the default id', async () => {
      console.log(await collection.insertOne({ name: 'test' }));
      const [found] = await collection.find({ name: 'test' }).toArray();
      const id = found._id;
      assert.ok(<any>id instanceof UUID);
      assert.strictEqual(id.version, 6);
    });
  });

  describe('uuidv7', () => {
    let collection: Collection;

    before(async function () {
      collection = await db.createCollection(TEST_COLLECTION_NAME, { defaultId: { type: 'uuidv7' } });
    });

    afterEach(async function () {
      await collection.deleteAll();
    });

    after(async function () {
      await db.dropCollection(TEST_COLLECTION_NAME);
    });

    it('is set in listCollections', async () => {
      const collections = await db.listCollections({ nameOnly: false });
      console.log(collections)
      const collection = collections.find(c => c.name === TEST_COLLECTION_NAME);
      assert.ok(collection);
      assert.deepStrictEqual(collection.options, { defaultId: { type: 'uuidv7' } });
    });

    it('sets it as the default id', async () => {
      console.log(await collection.insertOne({ name: 'test' }));
      const [found] = await collection.find({ name: 'test' }).toArray();
      const id = found._id;
      assert.ok(<any>id instanceof UUID);
      assert.strictEqual(id.version, 7);
    });
  });

  describe('objectId', () => {
    let collection: Collection;

    before(async function () {
      collection = await db.createCollection(TEST_COLLECTION_NAME, { defaultId: { type: 'objectId' } });
    });

    afterEach(async function () {
      await collection.deleteAll();
    });

    after(async function () {
      await db.dropCollection(TEST_COLLECTION_NAME);
    });

    it('is set in listCollections', async () => {
      const collections = await db.listCollections({ nameOnly: false });
      const collection = collections.find(c => c.name === TEST_COLLECTION_NAME);
      assert.ok(collection);
      assert.deepStrictEqual(collection.options, { defaultId: { type: 'objectId' } });
    });

    it('sets it as the default id', async () => {
      console.log(await collection.insertOne({ name: 'test' }));
      const [found] = await collection.find({ name: 'test' }).toArray();
      const id = found._id;
      assert.ok(<any>id instanceof ObjectId);
    });
  });
});
