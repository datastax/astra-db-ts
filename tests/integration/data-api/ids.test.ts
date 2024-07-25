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
import { ObjectId, UUID } from '@/src/data-api';
import { DEFAULT_COLLECTION_NAME, EPHEMERAL_COLLECTION_NAME } from '@/tests/fixtures';
import { createManagedCollection, describe, it } from '@/tests/test-utils';

describe('integration.data-api.ids', ({ db }) => {
  describe('default', { truncateColls: 'default' } , ({ collection }) => {
    it('is set in listCollections', async () => {
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === DEFAULT_COLLECTION_NAME);
      assert.ok(collection);
      assert.strictEqual(collection.options.defaultId, undefined);
    });

    it('sets it as the default id', async () => {
      const inserted = await collection.insertOne({ name: 'test' });
      assert.ok(typeof <any>inserted.insertedId === 'string');
      const found = await collection.findOne({ name: 'test' });
      const id = found?._id;
      assert.ok(typeof <any>id === 'string');
      assert.doesNotThrow(() => new UUID(id as string));
    });
  });

  describe('[long] uuid', () => {
    const name = `${EPHEMERAL_COLLECTION_NAME}_uuid`;
    const collection = createManagedCollection(db, name, { defaultId: { type: 'uuid' } });

    it('is set in listCollections', async () => {
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === name);
      assert.ok(collection);
      assert.deepStrictEqual(collection.options, { defaultId: { type: 'uuid' } });
    });

    it('sets it as the default id', async () => {
      const inserted = await collection.ref.insertOne({ name: 'test' });
      assert.ok(<any>inserted.insertedId instanceof UUID);
      const found = await collection.ref.findOne({ name: 'test' });
      const id = found?._id;
      assert.ok(id instanceof UUID);
      assert.strictEqual(id.version, 4);
      assert.ok(id.toString(), inserted.insertedId?.toString());
      assert.ok(id.equals(inserted.insertedId));
    });
  });

  describe('[long] uuidv6', () => {
    const name = `${EPHEMERAL_COLLECTION_NAME}_uuid_v6`;
    const collection = createManagedCollection(db, name, { defaultId: { type: 'uuidv6' } });

    it('is set in listCollections', async () => {
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === name);
      assert.ok(collection);
      assert.deepStrictEqual(collection.options, { defaultId: { type: 'uuidv6' } });
    });

    it('sets it as the default id', async () => {
      const inserted = await collection.ref.insertOne({ name: 'test' });
      assert.ok(<any>inserted.insertedId instanceof UUID);
      const found = await collection.ref.findOne({ name: 'test' });
      const id = found?._id;
      assert.ok(id instanceof UUID);
      assert.strictEqual(id.version, 6);
      assert.ok(id.toString(), inserted.insertedId?.toString());
      assert.ok(id.equals(inserted.insertedId));
    });
  });

  describe('[long] uuidv7', () => {
    const name = `${EPHEMERAL_COLLECTION_NAME}_uuid_v7`;
    const collection = createManagedCollection(db, name, { defaultId: { type: 'uuidv7' } });

    it('is set in listCollections', async () => {
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === name);
      assert.ok(collection);
      assert.deepStrictEqual(collection.options, { defaultId: { type: 'uuidv7' } });
    });

    it('sets it as the default id', async () => {
      const inserted = await collection.ref.insertOne({ name: 'test' });
      assert.ok(<any>inserted.insertedId instanceof UUID);
      const found = await collection.ref.findOne({ name: 'test' });
      const id = found?._id;
      assert.ok(id instanceof UUID);
      assert.strictEqual(id.version, 7);
      assert.ok(id.toString(), inserted.insertedId?.toString());
      assert.ok(id.equals(inserted.insertedId));
    });
  });

  describe('[long] objectId', () => {
    const name = `${EPHEMERAL_COLLECTION_NAME}__objectId`;
    const collection = createManagedCollection(db, name, { defaultId: { type: 'objectId' } });

    it('is set in listCollections', async () => {
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === name);
      assert.ok(collection);
      assert.deepStrictEqual(collection.options, { defaultId: { type: 'objectId' } });
    });

    it('sets it as the default id', async () => {
      const inserted = await collection.ref.insertOne({ name: 'test' });
      assert.ok(<any>inserted.insertedId instanceof ObjectId);
      const found = await collection.ref.findOne({ name: 'test' });
      const id = found?._id;
      assert.ok(id instanceof ObjectId);
      assert.ok(id.toString(), inserted.insertedId?.toString());
      assert.ok(id.equals(inserted.insertedId));
    });
  });
});
