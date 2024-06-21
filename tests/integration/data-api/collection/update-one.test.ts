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

import { Collection } from '@/src/data-api';
import { createSampleDocWithMultiLevel, initTestObjects } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.update-one', () => {
  let collection: Collection;

  before(async function () {
    [, , collection] = await initTestObjects(this);
  });

  beforeEach(async () => {
    await collection.deleteMany({});
  });

  it('should updateOne document by id', async () => {
    //insert a new doc
    const doc = createSampleDocWithMultiLevel();
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    //update doc
    const updateOneResp = await collection.updateOne({ '_id': idToCheck },
      {
        '$set': { 'username': 'aaronm' },
        '$unset': { 'address.city': '' }
      });
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    const updatedDoc = await collection.findOne({ 'username': 'aaronm' });
    assert.strictEqual(updatedDoc?._id, idToCheck);
    assert.strictEqual(updatedDoc.username, 'aaronm');
    assert.strictEqual(updatedDoc.address?.city, undefined);
  });

  it('should updateOne document by col', async () => {
    //insert a new doc
    const doc = createSampleDocWithMultiLevel();
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    //update doc
    const updateOneResp = await collection.updateOne({ 'address.city': 'big banana' },
      {
        '$set': { 'address.state': 'new state' }
      });
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    const updatedDoc = await collection.findOne({ 'username': 'aaron' });
    assert.strictEqual(updatedDoc?._id, idToCheck);
    assert.strictEqual(updatedDoc.username, 'aaron');
    assert.strictEqual(updatedDoc.address?.city, 'big banana');
    assert.strictEqual(updatedDoc.address.state, 'new state');
  });

  it('should updateOne with sort', async () => {
    await collection.insertMany([
      { username: 'a' },
      { username: 'c' },
      { username: 'b' }
    ]);

    await collection.updateOne(
      {},
      { $set: { username: 'aa' } },
      { sort: { username: 1 } }
    );

    const docs = await collection.find({}, { sort: { username: 1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.username), ['aa', 'b', 'c']);
  });

  it('should updateOne document by col with sort', async () => {
    const docs = [{ age: 2, user: 'a' }, { age: 0, user: 'a' }, { age: 1, user: 'a' }];
    await collection.insertMany(docs);
    const updateOneResp = await collection.updateOne({ user: 'a' }, { $set: { age: 10 } }, { sort: { age: 1 } });
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    const updatedDoc = await collection.find({}, { sort: { age: -1 }, limit: 20 }).toArray();
    assert.strictEqual(updatedDoc[0].age, 10);
  });

  it('should upsert a doc with upsert flag true in updateOne call', async () => {
    //insert a new doc
    const doc = createSampleDocWithMultiLevel();
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    //update doc
    const updateOneResp = await collection.updateOne({ 'address.city': 'nyc' },
      {
        '$set': { 'address.state': 'ny' }
      },
      {
        'upsert': true
      });
    assert.strictEqual(updateOneResp.modifiedCount, 0);
    assert.strictEqual(updateOneResp.matchedCount, 0);
    assert.ok(updateOneResp.upsertedId);
    assert.strictEqual(updateOneResp.upsertedCount, 1);
    const updatedDoc = await collection.findOne({ 'address.city': 'nyc' });
    assert.ok(updatedDoc?._id);
    assert.notStrictEqual(updatedDoc._id, idToCheck);
    assert.strictEqual(updatedDoc.address?.city, 'nyc');
    assert.strictEqual(updatedDoc.address.state, 'ny');
  });

  it('should not overwrite user-specified _id in $setOnInsert', async () => {
    await collection.deleteMany({});
    const updateOneResp = await collection.updateOne(
      {},
      {
        '$setOnInsert': {
          '_id': 'foo'
        },
        '$set': {
          'username': 'aaronm'
        }
      },
      {
        'upsert': true
      }
    );
    assert.equal(updateOneResp.upsertedId, 'foo');
  });
});
