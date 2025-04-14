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

import { it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';

parallel('integration.documents.collections.update-one', { truncate: 'colls:before' }, ({ collection }) => {
  it('should updateOne document by id', async (key) => {
    const insertDocResp = await collection.insertOne({ age: 3, key });
    const idToCheck = insertDocResp.insertedId;

    const updateOneResp = await collection.updateOne(
      { _id: idToCheck },
      {
        $set: { name: 'ruoska' },
        $unset: { age: '' },
      },
    );
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    assert.strictEqual(updateOneResp.upsertedCount, 0);

    const updatedDoc = await collection.findOne({ key });
    assert.strictEqual(updatedDoc?._id, idToCheck);
    assert.strictEqual(updatedDoc.name, 'ruoska');
    assert.strictEqual(updatedDoc.age, undefined);
  });

  it('should updateOne document by col', async (key) => {
    const insertDocResp = await collection.insertOne({ key });
    const idToCheck = insertDocResp.insertedId;

    const updateOneResp = await collection.updateOne(
      { key },
      { $set: { age: 3 } },
    );
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    assert.strictEqual(updateOneResp.upsertedCount, 0);

    const updatedDoc = await collection.findOne({ key: key });
    assert.strictEqual(updatedDoc?._id, idToCheck);
    assert.strictEqual(updatedDoc.age, 3);
  });

  it('should updateOne with sort', async (key) => {
    await collection.insertMany([
      { name: 'a', key },
      { name: 'c', key },
      { name: 'b', key },
    ]);

    await collection.updateOne(
      { key },
      { $set: { name: 'aa' } },
      { sort: { name: 1 } },
    );

    const docs = await collection.find({ key }, { sort: { name: 1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.name), ['aa', 'b', 'c']);
  });

  it('should updateOne document by col with sort', async (key) => {
    await collection.insertMany([
      { age: 2, user: 'a', key },
      { age: 0, user: 'a', key },
      { age: 1, user: 'a', key },
    ]);

    const updateOneResp = await collection.updateOne({ user: 'a', key }, { $set: { age: 10 } }, { sort: { age: 1 } });
    assert.strictEqual(updateOneResp.modifiedCount, 1);

    const updatedDoc = await collection.find({ key }, { sort: { age: -1 }, limit: 20 }).toArray();
    assert.strictEqual(updatedDoc[0].age, 10);
  });

  it('should upsert a doc with upsert flag true in updateOne call', async (key) => {
    const insertDocResp = await collection.insertOne({ key });
    const idToCheck = insertDocResp.insertedId;

    const updateOneResp = await collection.updateOne(
      { age: 12, key },
      { $set: { name: 'copperhead_road' } },
      { upsert: true },
    );
    assert.strictEqual(updateOneResp.modifiedCount, 0);
    assert.strictEqual(updateOneResp.matchedCount, 0);
    assert.ok(updateOneResp.upsertedId);
    assert.strictEqual(updateOneResp.upsertedCount, 1);

    const updatedDoc = await collection.findOne({ age: 12 });
    assert.ok(updatedDoc?._id);
    assert.notStrictEqual(updatedDoc._id, idToCheck);
    assert.strictEqual(updatedDoc.age, 12);
    assert.strictEqual(updatedDoc.name, 'copperhead_road');
  });

  it('should not overwrite user-specified _id in $setOnInsert', async (key) => {
    const updateOneResp = await collection.updateOne(
      { key },
      { $setOnInsert: { _id: 'foo' } },
      { upsert: true },
    );

    assert.equal(updateOneResp.upsertedId, 'foo');
  });
});
