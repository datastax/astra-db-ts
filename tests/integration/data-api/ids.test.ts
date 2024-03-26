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
import { DEFAULT_COLLECTION_NAME, EPHEMERAL_COLLECTION_NAME, testClient } from '@/tests/fixtures';

describe('integration.data-api.ids tests', () => {
  let db: Db;

  before(async function() {
    if (testClient == null) {
      return this.skip();
    }
    [, db] = await testClient.new();
  });

  describe('default', () => {
    let collection: Collection;

    before(async function () {
      collection = await db.createCollection(DEFAULT_COLLECTION_NAME);
    });

    afterEach(async function () {
      await collection.deleteAll();
    });

    it('is set in listCollections', async () => {
      const collections = await db.listCollections({ nameOnly: false });
      const collection = collections.find(c => c.name === DEFAULT_COLLECTION_NAME);
      assert.ok(collection);
      assert.deepStrictEqual(collection.options, {});
    });

    it('sets it as the default id', async () => {
      const inserted = await collection.insertOne({ name: 'test' });
      assert.ok(typeof <any>inserted.insertedId === 'string');
      const [found] = await collection.find({ name: 'test' }).toArray();
      const id = found._id;
      assert.ok(typeof <any>id === 'string');
      assert.doesNotThrow(() => new UUID(id));
    });
  });

  describe('uuid', () => {
    let collection: Collection;
    const name = `${EPHEMERAL_COLLECTION_NAME}_uuid`;

    before(async function () {
      collection = await db.createCollection(name, { defaultId: { type: 'uuid' } });
    });

    afterEach(async function () {
      await collection.deleteAll();
    });

    after(async function () {
      await db.dropCollection(name);
    });

    it('is set in listCollections', async () => {
      const collections = await db.listCollections({ nameOnly: false });
      const collection = collections.find(c => c.name === name);
      assert.ok(collection);
      assert.deepStrictEqual(collection.options, { defaultId: { type: 'uuid' } });
    });

    it('sets it as the default id', async () => {
      const inserted = await collection.insertOne({ name: 'test' });
      assert.ok(typeof <any>inserted.insertedId === 'string');
      const [found] = await collection.find({ name: 'test' }).toArray();
      const id = found._id;
      assert.ok(<any>id instanceof UUID);
      assert.strictEqual(id.version, 4);
    });
  });

  describe('uuidv6', () => {
    let collection: Collection;
    const name = `${EPHEMERAL_COLLECTION_NAME}_uuid_v6`;

    before(async function () {
      collection = await db.createCollection(name, { defaultId: { type: 'uuidv6' } });
    });

    afterEach(async function () {
      await collection.deleteAll();
    });

    after(async function () {
      await db.dropCollection(name);
    });

    it('is set in listCollections', async () => {
      const collections = await db.listCollections({ nameOnly: false });
      const collection = collections.find(c => c.name === name);
      assert.ok(collection);
      assert.deepStrictEqual(collection.options, { defaultId: { type: 'uuidv6' } });
    });

    it('sets it as the default id', async () => {
      const inserted = await collection.insertOne({ name: 'test' });
      assert.ok(typeof <any>inserted.insertedId === 'string');
      const [found] = await collection.find({ name: 'test' }).toArray();
      const id = found._id;
      assert.ok(<any>id instanceof UUID);
      assert.strictEqual(id.version, 6);
    });
  });

  describe('uuidv7', () => {
    let collection: Collection;
    const name = `${EPHEMERAL_COLLECTION_NAME}_uuid_v7`;

    before(async function () {
      collection = await db.createCollection(name, { defaultId: { type: 'uuidv7' } });
    });

    afterEach(async function () {
      await collection.deleteAll();
    });

    after(async function () {
      await db.dropCollection(name);
    });

    it('is set in listCollections', async () => {
      const collections = await db.listCollections({ nameOnly: false });
      const collection = collections.find(c => c.name === name);
      assert.ok(collection);
      assert.deepStrictEqual(collection.options, { defaultId: { type: 'uuidv7' } });
    });

    it('sets it as the default id', async () => {
      const inserted = await collection.insertOne({ name: 'test' });
      assert.ok(typeof <any>inserted.insertedId === 'string');
      const [found] = await collection.find({ name: 'test' }).toArray();
      const id = found._id;
      assert.ok(<any>id instanceof UUID);
      assert.strictEqual(id.version, 7);
    });
  });

  describe('objectId', () => {
    let collection: Collection;
    const name = `${EPHEMERAL_COLLECTION_NAME}_objectId`;

    before(async function () {
      collection = await db.createCollection(name, { defaultId: { type: 'objectId' } });
    });

    afterEach(async function () {
      await collection.deleteAll();
    });

    after(async function () {
      await db.dropCollection(name);
    });

    it('is set in listCollections', async () => {
      const collections = await db.listCollections({ nameOnly: false });
      const collection = collections.find(c => c.name === name);
      assert.ok(collection);
      assert.deepStrictEqual(collection.options, { defaultId: { type: 'objectId' } });
    });

    it('sets it as the default id', async () => {
      const inserted = await collection.insertOne({ name: 'test' });
      assert.ok(typeof <any>inserted.insertedId === 'string');
      const [found] = await collection.find({ name: 'test' }).toArray();
      const id = found._id;
      assert.ok(<any>id instanceof ObjectId);
    });
  });
});
