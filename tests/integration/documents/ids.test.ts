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
import { ObjectId, UUID } from '@/src/documents';
import { createCollections, DEFAULT_COLLECTION_NAME, it, parallel } from '@/tests/testlib';

parallel('(LONG) integration.documents.ids', { dropEphemeral: 'after' }, ({ db }) => {
  const collections = createCollections(() => ({
    default: db.collection(DEFAULT_COLLECTION_NAME).deleteMany({}).then(_ => db.collection(DEFAULT_COLLECTION_NAME)),
    uuid: db.createCollection(`${DEFAULT_COLLECTION_NAME}_uuid`, { defaultId: { type: 'uuid' } }),
    uuidv6: db.createCollection(`${DEFAULT_COLLECTION_NAME}_uuidv6`, { defaultId: { type: 'uuidv6' } }),
    uuidv7: db.createCollection(`${DEFAULT_COLLECTION_NAME}_uuidv7`, { defaultId: { type: 'uuidv7' } }),
    objectId: db.createCollection(`${DEFAULT_COLLECTION_NAME}_objectId`, { defaultId: { type: 'objectId' } }),
  }));

  it('default id is not in listCollections', async () => {
    const collections = await db.listCollections();
    const collection = collections.find(c => c.name === DEFAULT_COLLECTION_NAME);
    assert.ok(collection);
    assert.strictEqual(collection.options.defaultId, undefined);
  });

  it('default id is set as the default id', async () => {
    const inserted = await collections.default.insertOne({ name: 'test' });
    assert.ok(typeof <any>inserted.insertedId === 'string');
    const found = await collections.default.findOne({ name: 'test' });
    const id = found?._id;
    assert.ok(typeof <any>id === 'string');
    assert.doesNotThrow(() => new UUID(id as string));
  });

  it('uuid is set in listCollections', async () => {
    const collections = await db.listCollections();
    const collection = collections.find(c => c.name === `${DEFAULT_COLLECTION_NAME}_uuid`);
    assert.ok(collection);
    assert.deepStrictEqual(collection.options, { defaultId: { type: 'uuid' } });
  });

  it('uuid sets it as the default id', async () => {
    const inserted = await collections.uuid.insertOne({ name: 'test' });
    assert.ok(<any>inserted.insertedId instanceof UUID);
    const found = await collections.uuid.findOne({ name: 'test' });
    const id = found?._id;
    assert.ok(id instanceof UUID);
    assert.strictEqual(id.version, 4);
    assert.ok(id.toString(), inserted.insertedId?.toString());
    assert.ok(id.equals(inserted.insertedId));
  });

  it('uuidv6 is set in listCollections', async () => {
    const collections = await db.listCollections();
    const collection = collections.find(c => c.name === `${DEFAULT_COLLECTION_NAME}_uuidv6`);
    assert.ok(collection);
    assert.deepStrictEqual(collection.options, { defaultId: { type: 'uuidv6' } });
  });

  it('uuidv6 sets it as the default id', async () => {
    const inserted = await collections.uuidv6.insertOne({ name: 'test' });
    assert.ok(<any>inserted.insertedId instanceof UUID);
    const found = await collections.uuidv6.findOne({ name: 'test' });
    const id = found?._id;
    assert.ok(id instanceof UUID);
    assert.strictEqual(id.version, 6);
    assert.ok(id.toString(), inserted.insertedId?.toString());
    assert.ok(id.equals(inserted.insertedId));
  });

  it('uuidv7 is set in listCollections', async () => {
    const collections = await db.listCollections();
    const collection = collections.find(c => c.name === `${DEFAULT_COLLECTION_NAME}_uuidv7`);
    assert.ok(collection);
    assert.deepStrictEqual(collection.options, { defaultId: { type: 'uuidv7' } });
  });

  it('uuidv7 sets it as the default id', async () => {
    const inserted = await collections.uuidv7.insertOne({ name: 'test' });
    assert.ok(<any>inserted.insertedId instanceof UUID);
    const found = await collections.uuidv7.findOne({ name: 'test' });
    const id = found?._id;
    assert.ok(id instanceof UUID);
    assert.strictEqual(id.version, 7);
    assert.ok(id.toString(), inserted.insertedId?.toString());
    assert.ok(id.equals(inserted.insertedId));
  });

  it('objectId is set in listCollections', async () => {
    const collections = await db.listCollections();
    const collection = collections.find(c => c.name === `${DEFAULT_COLLECTION_NAME}_objectId`);
    assert.ok(collection);
    assert.deepStrictEqual(collection.options, { defaultId: { type: 'objectId' } });
  });

  it('objectId sets it as the default id', async () => {
    const inserted = await collections.objectId.insertOne({ name: 'test' });
    assert.ok(<any>inserted.insertedId instanceof ObjectId);
    const found = await collections.objectId.findOne({ name: 'test' });
    const id = found?._id;
    assert.ok(id instanceof ObjectId);
    assert.ok(id.toString(), inserted.insertedId?.toString());
    assert.ok(id.equals(inserted.insertedId));
  });
});
