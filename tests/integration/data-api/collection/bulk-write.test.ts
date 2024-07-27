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

import { BulkWriteError, DataAPIError } from '@/src/data-api';
import { describe, initCollectionWithFailingClient, it } from '@/tests/testlib';
import assert from 'assert';

describe('integration.data-api.collection.bulk-write', { truncateColls: 'default' }, ({ collection }) => {
  it('bulkWrites ordered', async () => {
    const res = await collection.bulkWrite([
      { insertOne: { document: { name: 'John' } } },
      { replaceOne: { filter: { name: 'John' }, replacement: { name: 'Jane' } } },
      { replaceOne: { filter: { name: 'John' }, replacement: { name: 'Dave' }, upsert: true } },
      { deleteOne: { filter: { name: 'Jane' } } },
      { updateOne: { filter: { name: 'Tim' }, update: { $set: { name: 'Sam' } } } },
      { updateOne: { filter: { name: 'Tim' }, update: { $set: { name: 'John' } }, upsert: true } },
      { updateMany: { filter: { name: 'John' }, update: { $set: { name: 'Jane' } } } },
      { insertOne: { document: { name: 'Jane' } } },
      { deleteMany: { filter: { name: 'Jane' } } },
    ], { ordered: true });

    assert.strictEqual(res.insertedCount, 2);
    assert.strictEqual(res.matchedCount, 2);
    assert.strictEqual(res.modifiedCount, 2);
    assert.strictEqual(res.deletedCount, 3);
    assert.strictEqual(res.upsertedCount, 2);
    assert.ok(res.upsertedIds[2]);
    assert.ok(res.upsertedIds[5]);
    assert.ok(!res.upsertedIds[0] && !res.upsertedIds[1] && !res.upsertedIds[3] && !res.upsertedIds[4] && !res.upsertedIds[6]);
    assert.strictEqual(res.getUpsertedIdAt(2), res.upsertedIds[2]);
    assert.strictEqual(res.getUpsertedIdAt(5), res.upsertedIds[5]);
    assert.strictEqual(res.getUpsertedIdAt(0), res.upsertedIds[0]);
    assert.strictEqual(res.getUpsertedIdAt(1), res.upsertedIds[1]);
    assert.strictEqual(res.getRawResponse().length, 9);

    const found = await collection.find({}).toArray();
    assert.strictEqual(found.length, 1);
    assert.strictEqual(found[0].name, 'Dave');
    assert.ok(found[0]._id);
  });

  it('bulkWrites unordered', async () => {
    const res = await collection.bulkWrite([
      { insertOne: { document: { name: 'John'} } },
      { updateOne: { filter: { name: 'Tim' }, update: { $set: { name: 'Jim' } }, upsert: true } },
      { deleteOne: { filter: { name: 'Jane' } } },
    ]);

    assert.strictEqual(res.insertedCount, 1);
    assert.strictEqual(res.matchedCount, 0);
    assert.strictEqual(res.modifiedCount, 0);
    assert.strictEqual(res.deletedCount, 0);
    assert.strictEqual(res.upsertedCount, 1);
    assert.ok(res.upsertedIds[1]);
    assert.ok(!res.upsertedIds[0] && !res.upsertedIds[2]);
    assert.strictEqual(res.getUpsertedIdAt(0), res.upsertedIds[0]);
    assert.strictEqual(res.getUpsertedIdAt(1), res.upsertedIds[1]);
    assert.strictEqual(res.getUpsertedIdAt(2), res.upsertedIds[2]);
    assert.strictEqual(res.getRawResponse().length, 3);

    const found = (await collection.find({}).toArray()).sort((a, b) => a.name.localeCompare(b.name));
    assert.strictEqual(found.length, 2);
    assert.strictEqual(found[0].name, 'Jim');
    assert.strictEqual(found[1].name, 'John');
    assert.ok(found[0]._id);
    assert.ok(found[1]._id);
  });

  it('fails gracefully on 2XX exceptions when ordered', async () => {
    try {
      await collection.bulkWrite([
        { insertOne: { document: { _id: 'a' } } },
        { insertOne: { document: { _id: 'b' } } },
        { insertOne: { document: { _id: 'c' } } },
        { insertOne: { document: { _id: 'a' } } },
        { insertOne: { document: { _id: 'a' } } },
        { insertOne: { document: { _id: 'd' } } },
        { insertOne: { document: { _id: 'e' } } },
      ], { ordered: true });
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof BulkWriteError);

      assert.strictEqual(e.detailedErrorDescriptors.length, 1);
      assert.strictEqual(e.errorDescriptors.length, 1);
      assert.strictEqual(e.message, e.errorDescriptors[0].message);
      assert.deepStrictEqual(e.errorDescriptors[0].attributes, {});

      assert.strictEqual(e.partialResult.insertedCount, 3);
      assert.strictEqual(e.partialResult.getRawResponse().length, 4);
      assert.strictEqual(e.partialResult.deletedCount, 0);
      assert.strictEqual(e.partialResult.modifiedCount, 0);
      assert.strictEqual(e.partialResult.matchedCount, 0);
      assert.strictEqual(e.partialResult.upsertedCount, 0);
      assert.deepStrictEqual(e.partialResult.upsertedIds, {});

      const found = (await collection.find({}).toArray()).sort((a, b) => a._id!.toString().localeCompare(b._id!.toString()));
      assert.strictEqual(found.length, 3);
      assert.strictEqual(found[0]._id, 'a');
      assert.strictEqual(found[1]._id, 'b');
      assert.strictEqual(found[2]._id, 'c');
    }
  });

  it('fails gracefully on 2XX exceptions when unordered', async () => {
    try {
      await collection.bulkWrite([
        { insertOne: { document: { _id: 'a' } } },
        { insertOne: { document: { _id: 'b' } } },
        { insertOne: { document: { _id: 'c' } } },
        { insertOne: { document: { _id: 'a' } } },
        { insertOne: { document: { _id: 'a' } } },
        { insertOne: { document: { _id: 'd' } } },
        { insertOne: { document: { _id: 'e' } } },
      ]);
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof BulkWriteError);

      assert.strictEqual(e.detailedErrorDescriptors.length, 2);
      assert.strictEqual(e.errorDescriptors.length, 2);
      assert.strictEqual(e.message, e.errorDescriptors[0].message);
      assert.deepStrictEqual(e.errorDescriptors[0].attributes, {});

      assert.strictEqual(e.partialResult.insertedCount, 5);
      assert.strictEqual(e.partialResult.getRawResponse().length, 7);
      assert.strictEqual(e.partialResult.deletedCount, 0);
      assert.strictEqual(e.partialResult.modifiedCount, 0);
      assert.strictEqual(e.partialResult.matchedCount, 0);
      assert.strictEqual(e.partialResult.upsertedCount, 0);
      assert.deepStrictEqual(e.partialResult.upsertedIds, {});

      const found = (await collection.find({}).toArray()).sort((a, b) => a._id!.toString().localeCompare(b._id!.toString()));
      assert.strictEqual(found.length, 5);
      assert.strictEqual(found[0]._id, 'a');
      assert.strictEqual(found[1]._id, 'b');
      assert.strictEqual(found[2]._id, 'c');
      assert.strictEqual(found[3]._id, 'd');
      assert.strictEqual(found[4]._id, 'e');
    }
  });

  it('fail gracefully on unknown operation', async () => {
    try {
      await collection.bulkWrite([
        { insertOne: { document: { _id: 'a' } } },
        // @ts-expect-error - testing unknown operation
        { unknownOperation: { document: { _id: 'b' } } },
      ]);
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.strictEqual(e.message, `Unknown bulk write operation: ${JSON.stringify({ unknownOperation: { document: { _id: 'b' } } })}`);
    }
  });

  it('fails fast on hard errors ordered', async () => {
    const collection = initCollectionWithFailingClient();
    try {
      await collection.bulkWrite([{ insertOne: { document: { _id: 'a' } } }], { ordered: true });
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.ok(!(e instanceof DataAPIError));
      assert.strictEqual(e.message, 'test');
    }
  });

  it('fails fast on hard errors unordered', async () => {
    const collection = initCollectionWithFailingClient();
    try {
      await collection.bulkWrite([{ insertOne: { document: { _id: 'a' } } }], { ordered: false });
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.ok(!(e instanceof DataAPIError));
      assert.strictEqual(e.message, 'test');
    }
  });
});
