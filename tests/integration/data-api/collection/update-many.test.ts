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

import { DataAPIError, UpdateManyError } from '@/src/documents';
import { initCollectionWithFailingClient, it, parallel } from '@/tests/testlib';
import assert from 'assert';

parallel('integration.data-api.collection.update-many', { truncateColls: 'default:before' }, ({ collection }) => {
  it('should updateMany documents with ids', async (key) => {
    const docs = [{ _id: `${key}1`, age: 1, key }, { _id: `${key}2`, age: 2, key }, { _id: `${key}3`, age: 3, key }];
    const res = await collection.insertMany(docs);
    assert.strictEqual(res.insertedCount, docs.length);

    const idToUpdateAndCheck = docs[0]._id;
    const updateManyResp = await collection.updateMany(
      { _id: idToUpdateAndCheck },
      {
        $set: { name: 'aether_realm' },
        $unset: { age: '' },
      },
    );
    assert.strictEqual(updateManyResp.matchedCount, 1);
    assert.strictEqual(updateManyResp.modifiedCount, 1);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);

    const updatedDoc = await collection.findOne({ name: 'aether_realm', key });
    assert.strictEqual(updatedDoc?._id, idToUpdateAndCheck);
    assert.strictEqual(updatedDoc.name, 'aether_realm');
    assert.strictEqual(updatedDoc.age, undefined);
  });

  it('should update when updateMany is invoked with updates for records <= 20', async (key) => {
    const docList = Array.from({ length: 20 }, () => ({ key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateManyResp = await collection.updateMany(
      { key: key },
      { $set: { name: 'soad' } },
    );
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 20);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
  });

  it('should update when updateMany is invoked with updates for records > 20', async (key) => {
    const docList = Array.from({ length: 101 }, () => ({ key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateManyResp = await collection.updateMany(
      { key: key },
      { $set: { name: 'soad' } },
    );
    assert.strictEqual(updateManyResp.matchedCount, 101);
    assert.strictEqual(updateManyResp.modifiedCount, 101);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
  });

  it('should upsert with upsert flag set to false/not set when not found', async (key) => {
    const docList = Array.from({ length: 20 }, () => ({ key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateManyResp = await collection.updateMany(
      { key: 'dream_theater' },
      { $set: { age: 10 } },
    );
    assert.strictEqual(updateManyResp.matchedCount, 0);
    assert.strictEqual(updateManyResp.modifiedCount, 0);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
  });

  it('should upsert with upsert flag set to true when not found', async (key) => {
    const docList = Array.from({ length: 20 }, () => ({ key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateManyResp = await collection.updateMany(
      { key: 'feuerschwanz' },
      { $set: { age: 10 } },
      { upsert: true },
    );
    assert.strictEqual(updateManyResp.matchedCount, 0);
    assert.strictEqual(updateManyResp.modifiedCount, 0);
    assert.strictEqual(updateManyResp.upsertedCount, 1);
    assert.ok(updateManyResp.upsertedId);
  });

  it('should increment number when $inc is used', async (key) => {
    const docList = Array.from({ length: 20 }, (_, i) => ({
      _id: `${key}${i}`,
      age: i === 5 ? 5 : (i === 8 ? 8 : i),
      key,
    }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateOneResp = await collection.updateOne({ _id: `${key}5`, key }, { $inc: { age: 1 } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);

    const updatedDoc = await collection.findOne({ _id: `${key}5`, key });
    assert.strictEqual(updatedDoc?.age, 6);

    const updateManyResp = await collection.updateMany({ key }, { $inc: { age: 1 } });
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 20);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);

    const allDocs = await collection.find({ key }).toArray();
    assert.strictEqual(allDocs.length, 20);

    allDocs.forEach((doc) => {
      assert.ok(typeof <unknown>doc._id === 'string');

      const docIdNum = parseInt((<string>doc._id).slice(key.length));

      if (docIdNum === 5) {
        assert.strictEqual(doc.age, 7);
      } else if (docIdNum === 8) {
        assert.strictEqual(doc.age, 9);
      } else {
        assert.strictEqual(doc.age, parseInt((<string>doc._id).substring(key.length)) + 1);
      }
    });
  });

  it('should increment decimal when $inc is used', async (key) => {
    const docList = Array.from({ length: 20 }, (_, i) => ({
      _id: `${key}${i}`,
      age: i === 5 ? 5.5 : (i === 8 ? 8.5 : i + 0.5),
      key,
    }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    
    const updateOneResp = await collection.updateOne({ _id: `${key}5`, key }, { $inc: { age: 1 } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    
    const updatedDoc = await collection.findOne({ _id: `${key}5`, key });
    assert.strictEqual(updatedDoc?.age, 6.5);
    
    const updateManyResp = await collection.updateMany({ key }, { $inc: { age: 1 } });
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 20);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    
    const allDocs = await collection.find({ key }).toArray();
    assert.strictEqual(allDocs.length, 20);
    
    allDocs.forEach((doc) => {
      assert.ok(typeof <unknown>doc._id === 'string');
      
      const docIdNum = parseInt((<string>doc._id).substring(key.length));
      
      if (docIdNum === 5) {
        assert.strictEqual(doc.age, 7.5);
      } else if (docIdNum === 8) {
        assert.strictEqual(doc.age, 9.5);
      } else {
        assert.strictEqual(doc.age, parseInt((<string>doc._id).substring(key.length)) + 0.5 + 1);
      }
    });
  });

  it('should rename a field when $rename is used in update and updateMany', async (key) => {
    const docList = Array.from({ length: 20 }, (_, i) => ({
      _id: `${key}${i}`,
      key,
    }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    
    const updateOneResp = await collection.updateOne({ _id: `${key}5`, key }, { $rename: { key: 'name' } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    
    const updatedDoc = await collection.findOne({ _id: `${key}5`, name: key });
    assert.strictEqual(updatedDoc?.name, key);
    assert.strictEqual(updatedDoc.key, undefined);
    
    const updateManyResp = await collection.updateMany({ key }, { $rename: { key: 'name' } });
    assert.strictEqual(updateManyResp.matchedCount, 19);
    assert.strictEqual(updateManyResp.modifiedCount, 19);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    
    const allDocs = await collection.find({ name: key }).toArray();
    assert.strictEqual(allDocs.length, 20);
    
    allDocs.forEach((doc) => {
      assert.strictEqual(doc.name, key);
      assert.strictEqual(doc.key, undefined);
    });
  });

  it('should rename a sub doc field when $rename is used in update and updateMany', async (key) => {
    const docList = Array.from({ length: 20 }, (_, i) => ({
      _id: `${key}${i}`,
      key,
      nested: { key },
    }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateOneResp = await collection.updateOne({ _id: `${key}5`, key }, { $rename: { 'nested.key': 'nested.name' } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);

    const updatedDoc = await collection.findOne({ _id: `${key}5`, key });
    assert.strictEqual(updatedDoc?.nested.name, key);
    assert.strictEqual(updatedDoc.nested.key, undefined);

    const updateManyResp = await collection.updateMany({ key }, { $rename: { 'nested.key': 'nested.name' } });
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 19);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);

    const allDocs = await collection.find({ key }).toArray();
    assert.strictEqual(allDocs.length, 20);

    allDocs.forEach((doc) => {
      assert.strictEqual(doc.nested.name, key);
      assert.strictEqual(doc.nested.key, undefined);
    });
  });

  it('should set date to current date in the fields inside $currentDate in update and updateMany', async (key) => {
    const docList = Array.from({ length: 20 }, (_, i) => ({ _id: `${key}${i}`, key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateOneResp = await collection.updateOne({ _id: `${key}5`, key }, { $currentDate: { date: true } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ _id: `${key}5`, key });
    assert.ok(updatedDoc?.date);

    const updateManyResp = await collection.updateMany({ key }, { $currentDate: { date: true } });
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 20);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);

    const allDocs = await collection.find({ key }).toArray();
    assert.strictEqual(allDocs.length, 20);

    allDocs.forEach((doc) => {
      assert.ok(doc.date);
    });
  });

  it('should set fields under $setOnInsert when upsert is true in updateOne', async (key) => {
    const docList = Array.from({ length: 20 }, (_, i) => ({ _id: `${key}${i}`, key, name: 'idk' }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateOneResp = await collection.updateOne({ _id: `${key}5`, key }, {
      $set: { name: 'rammstein' },
      $setOnInsert: { age: 20 },
    }, { upsert: true });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);

    const updatedDoc = await collection.findOne({ _id: `${key}5`, key });
    assert.strictEqual(updatedDoc?.name, 'rammstein');
    assert.strictEqual(updatedDoc.age, undefined);

    const updateOneResp1 = await collection.updateOne({ _id: `${key}21`, key }, {
      $set: { name: 'rammstein' },
      $setOnInsert: { age: 20 },
    }, { upsert: true });
    assert.strictEqual(updateOneResp1.matchedCount, 0);
    assert.strictEqual(updateOneResp1.modifiedCount, 0);
    assert.strictEqual(updateOneResp1.upsertedCount, 1);
    assert.strictEqual(updateOneResp1.upsertedId, `${key}21`);

    const updatedDoc1 = await collection.findOne({ _id: `${key}21`, key });
    assert.strictEqual(updatedDoc1?.name, 'rammstein');
    assert.strictEqual(updatedDoc1.age, 20);
  });

  it('should set fields under $setOnInsert when upsert is true in updateMany', async (key) => {
    const docList = Array.from({ length: 20 }, (_, i) => ({ _id: `${key}${i}`, key, name: 'idk' }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateManyResp = await collection.updateMany({ _id: `${key}5`, key }, {
      $set: { name: 'rammstein' },
      $setOnInsert: { age: 20 },
    }, { upsert: true });
    assert.strictEqual(updateManyResp.matchedCount, 1);
    assert.strictEqual(updateManyResp.modifiedCount, 1);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);

    const updatedDoc = await collection.findOne({ _id: `${key}5`, key });
    assert.strictEqual(updatedDoc?.name, 'rammstein');
    assert.strictEqual(updatedDoc.age, undefined);

    const updateManyResp1 = await collection.updateMany({ _id: `${key}21`, key }, {
      $set: { name: 'rammstein' },
      $setOnInsert: { age: 20 },
    }, { upsert: true });
    assert.strictEqual(updateManyResp1.matchedCount, 0);
    assert.strictEqual(updateManyResp1.modifiedCount, 0);
    assert.strictEqual(updateManyResp1.upsertedCount, 1);
    assert.strictEqual(updateManyResp1.upsertedId, `${key}21`);

    const updatedDoc1 = await collection.findOne({ _id: `${key}21`, key });
    assert.strictEqual(updatedDoc1?.name, 'rammstein');
    assert.strictEqual(updatedDoc1.age, 20);
  });

  it('should set a field value to new value when the new value is < existing value with $min in updateOne and updateMany', async (key) => {
    const docList = Array.from({ length: 20 }, (_, i) => ({ _id: `${key}${i}`, age: i === 4 ? 10 : 50, key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    
    const updateOneResp = await collection.updateOne({ _id: `${key}4`, key }, { $min: { age: 5 } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);

    const updatedDoc = await collection.findOne({ _id: `${key}4`, key });
    assert.strictEqual(updatedDoc?.age, 5);

    const updateOneResp1 = await collection.updateOne({ _id: `${key}4`, key }, { $min: { age: 15 } });
    assert.strictEqual(updateOneResp1.matchedCount, 1);
    assert.strictEqual(updateOneResp1.modifiedCount, 0);
    assert.strictEqual(updateOneResp1.upsertedCount, 0);
    assert.strictEqual(updateOneResp1.upsertedId, undefined);

    const updatedDoc1 = await collection.findOne({ _id: `${key}4`, key });
    assert.strictEqual(updatedDoc1?.age, 5);

    const updateManyResp = await collection.updateMany({ key }, { $min: { age: 15 } });
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 19);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);

    const allDocs = await collection.find({ key }).toArray();
    allDocs.forEach(doc => {
      if (doc._id === `${key}4`) {
        assert.strictEqual(doc.age, 5);
      } else {
        assert.strictEqual(doc.age, 15);
      }
    });

    const updateManyResp1 = await collection.updateMany({ key }, { $min: { age: 50 } });
    assert.strictEqual(updateManyResp1.matchedCount, 20);
    assert.strictEqual(updateManyResp1.modifiedCount, 0);
    assert.strictEqual(updateManyResp1.upsertedCount, 0);
    assert.strictEqual(updateManyResp1.upsertedId, undefined);

    const allDocs1 = await collection.find({ key }).toArray();
    allDocs1.forEach(doc => {
      if (doc._id === `${key}4`) {
        assert.strictEqual(doc.age, 5);
      } else {
        assert.strictEqual(doc.age, 15);
      }
    });
  });

  it('should set a field value to new value when the new value is > existing value with $max in updateOne and updateMany', async (key) => {
    const docList = Array.from({ length: 20 }, (_, i) => ({ _id: `${key}${i}`, age: i === 4 ? 900 : 800, key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateOneResp = await collection.updateOne({ _id: `${key}4`, key }, { $max: { age: 950 } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);

    const updatedDoc = await collection.findOne({ _id: `${key}4`, key });
    assert.strictEqual(updatedDoc?.age, 950);

    const updateOneResp1 = await collection.updateOne({ _id: `${key}4`, key }, { $max: { age: 15 } });
    assert.strictEqual(updateOneResp1.matchedCount, 1);
    assert.strictEqual(updateOneResp1.modifiedCount, 0);
    assert.strictEqual(updateOneResp1.upsertedCount, 0);
    assert.strictEqual(updateOneResp1.upsertedId, undefined);

    const updatedDoc1 = await collection.findOne({ _id: `${key}4`, key });
    assert.strictEqual(updatedDoc1?.age, 950);

    const updateManyResp = await collection.updateMany({ key }, { $max: { age: 900 } });
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 19);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);

    const allDocs = await collection.find({ key }).toArray();
    allDocs.forEach(doc => {
      if (doc._id === `${key}4`) {
        assert.strictEqual(doc.age, 950);
      } else {
        assert.strictEqual(doc.age, 900);
      }
    });

    const updateManyResp1 = await collection.updateMany({ key }, { $max: { age: 50 } });
    assert.strictEqual(updateManyResp1.matchedCount, 20);
    assert.strictEqual(updateManyResp1.modifiedCount, 0);
    assert.strictEqual(updateManyResp1.upsertedCount, 0);
    assert.strictEqual(updateManyResp1.upsertedId, undefined);

    const allDocs1 = await collection.find({ key }).toArray();
    allDocs1.forEach(doc => {
      if (doc._id === `${key}4`) {
        assert.strictEqual(doc.age, 950);
      } else {
        assert.strictEqual(doc.age, 900);
      }
    });
  });

  it('should multiply a value by number provided for each field in the $mul in updateOne and updateMany', async (key) => {
    const docList = Array.from({ length: 5 }, (_, i) => ({ _id: `${key}${i}`, age: 50, key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateOneResp = await collection.updateOne({ _id: `${key}4`, key }, { $mul: { age: 1.07 } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);

    const updatedDoc = await collection.findOne({ _id: `${key}4`, key });
    assert.strictEqual(updatedDoc?.age, 53.5);

    const updateManyResp = await collection.updateMany({ _id: { $in: [`${key}0`, `${key}1`, `${key}2`, `${key}3`] }, key }, { $mul: { age: 1.07 } });
    assert.strictEqual(updateManyResp.matchedCount, 4);
    assert.strictEqual(updateManyResp.modifiedCount, 4);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);

    const allDocs = await collection.find({ key }).toArray();
    allDocs.forEach(doc => {
      assert.strictEqual(doc.age, 53.5);
    });
  });

  it('should push an element to an array when an item is added using $push', async (key) => {
    const docList = Array.from({ length: 5 }, (_, i) => ({ _id: `${key}${i}`, arr: ['tag1', 'tag2'], key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateOneResp = await collection.updateOne({ _id: `${key}4`, key }, { $push: { arr: 'tag3' } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);

    const updatedDoc = await collection.findOne({ _id: `${key}4`, key });
    assert.strictEqual(updatedDoc?.arr.length, 3);
    assert.strictEqual(updatedDoc.arr[2], 'tag3');

    const updateManyResp = await collection.updateMany({ key }, { $push: { arr: 'tag3' } });
    assert.strictEqual(updateManyResp.matchedCount, 5);
    assert.strictEqual(updateManyResp.modifiedCount, 5);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);

    const allDocs = await collection.find({ key }).toArray();
    assert.strictEqual(allDocs.length, 5);
    
    allDocs.forEach(doc => {
      if (doc._id === `${key}4`) {
        assert.strictEqual(doc.arr.length, 4);
        assert.strictEqual(doc.arr[2], 'tag3');
        assert.strictEqual(doc.arr[3], 'tag3');
      } else {
        assert.strictEqual(doc.arr.length, 3);
        assert.strictEqual(doc.arr[2], 'tag3');
      }
    });
  });

  it('should push an element to an array when each item in $each is added using $push with $position', async (key) => {
    const docList = Array.from({ length: 5 }, (_, i) => ({ _id: `${key}${i}`, arr: ['tag1', 'tag2'], key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateOneResp = await collection.updateOne({ _id: `${key}4`, key }, {
      $push: {
        arr: {
          $each: ['tag3', 'tag4'],
          $position: 1,
        },
      },
    });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);

    const updatedDoc = await collection.findOne({ _id: `${key}4`, key });
    assert.strictEqual(updatedDoc?.arr.length, 4);
    assert.strictEqual(updatedDoc.arr[1], 'tag3');
    assert.strictEqual(updatedDoc.arr[2], 'tag4');

    const updateManyResp = await collection.updateMany({ key }, {
      $push: {
        arr: {
          $each: ['tag3', 'tag4'],
          $position: 1,
        },
      },
    });
    assert.strictEqual(updateManyResp.matchedCount, 5);
    assert.strictEqual(updateManyResp.modifiedCount, 5);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);

    const allDocs = await collection.find({ key }).toArray();
    assert.strictEqual(allDocs.length, 5);

    allDocs.forEach(doc => {
      if (doc._id === `${key}4`) {
        assert.strictEqual(doc.arr.length, 6);
        assert.strictEqual(doc.arr[1], 'tag3');
        assert.strictEqual(doc.arr[2], 'tag4');
        assert.strictEqual(doc.arr[3], 'tag3');
        assert.strictEqual(doc.arr[4], 'tag4');
      } else {
        assert.strictEqual(doc.arr.length, 4);
        assert.strictEqual(doc.arr[1], 'tag3');
        assert.strictEqual(doc.arr[2], 'tag4');
      }
    });
  });

  it('should push an element to an array skipping duplicates when an item is added using $addToSet', async (key) => {
    const docList = Array.from({ length: 5 }, (_, i) => ({ _id: `${key}${i}`, arr: ['tag1', 'tag2'], key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateOneResp = await collection.updateOne({ _id: `${key}4`, key }, { $addToSet: { arr: 'tag3' } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);

    const updatedDoc = await collection.findOne({ _id: `${key}4`, key });
    assert.strictEqual(updatedDoc?.arr.length, 3);
    assert.strictEqual(updatedDoc.arr[2], 'tag3');

    const updateOneResp2 = await collection.updateOne({ _id: `${key}4`, key }, { $addToSet: { arr: 'tag3' } });
    assert.strictEqual(updateOneResp2.matchedCount, 1);
    assert.strictEqual(updateOneResp2.modifiedCount, 0);
    assert.strictEqual(updateOneResp2.upsertedCount, 0);
    assert.strictEqual(updateOneResp2.upsertedId, undefined);

    const updatedDoc2 = await collection.findOne({ _id: `${key}4`, key });
    assert.strictEqual(updatedDoc2?.arr.length, 3);
    assert.strictEqual(updatedDoc2.arr[2], 'tag3');

    const updateManyResp = await collection.updateMany({ key }, { $addToSet: { arr: 'tag3' } });
    assert.strictEqual(updateManyResp.matchedCount, 5);
    assert.strictEqual(updateManyResp.modifiedCount, 4);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);

    const allDocs = await collection.find({ key }).toArray();
    assert.strictEqual(allDocs.length, 5);

    allDocs.forEach(doc => {
      assert.strictEqual(doc.arr.length, 3);
      assert.strictEqual(doc.arr[2], 'tag3');
    });

    const updateManyResp2 = await collection.updateMany({ key }, { $addToSet: { arr: 'tag3' } });
    assert.strictEqual(updateManyResp2.matchedCount, 5);
    assert.strictEqual(updateManyResp2.modifiedCount, 0);
    assert.strictEqual(updateManyResp2.upsertedCount, 0);
    assert.strictEqual(updateManyResp2.upsertedId, undefined);

    const allDocs2 = await collection.find({ key }).toArray();
    assert.strictEqual(allDocs2.length, 5);

    allDocs2.forEach(doc => {
      assert.strictEqual(doc.arr.length, 3);
      assert.strictEqual(doc.arr[2], 'tag3');
    });
  });

  it('should push an element to an array skipping duplicates when an item is added using $addToSet with $each', async (key) => {
    const docList = Array.from({ length: 5 }, (_, i) => ({ _id: `${key}${i}`, arr: ['tag1', 'tag2'], key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    
    const updateOneResp = await collection.updateOne({ _id: `${key}4`, key }, { $addToSet: { arr: { $each: ['tag3', 'tag4'] } } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    
    const updatedDoc = await collection.findOne({ _id: `${key}4`, key });
    assert.strictEqual(updatedDoc?.arr.length, 4);
    assert.strictEqual(updatedDoc.arr[2], 'tag3');
    assert.strictEqual(updatedDoc.arr[3], 'tag4');
    
    const updateOneResp2 = await collection.updateOne({ _id: `${key}4`, key }, { $addToSet: { arr: { $each: ['tag3', 'tag4'] } } });
    assert.strictEqual(updateOneResp2.matchedCount, 1);
    assert.strictEqual(updateOneResp2.modifiedCount, 0);
    assert.strictEqual(updateOneResp2.upsertedCount, 0);
    assert.strictEqual(updateOneResp2.upsertedId, undefined);
    
    await collection.findOne({ _id: `${key}4`, key });
    assert.strictEqual(updatedDoc.arr.length, 4);
    assert.strictEqual(updatedDoc.arr[2], 'tag3');
    assert.strictEqual(updatedDoc.arr[3], 'tag4');
    
    const updateManyResp = await collection.updateMany({ key }, { $addToSet: { arr: { $each: ['tag3', 'tag4'] } } });
    assert.strictEqual(updateManyResp.matchedCount, 5);
    assert.strictEqual(updateManyResp.modifiedCount, 4);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    
    const allDocs = await collection.find({ key }).toArray();
    assert.strictEqual(allDocs.length, 5);
    
    allDocs.forEach(doc => {
      assert.strictEqual(doc.arr.length, 4);
      assert.strictEqual(doc.arr[2], 'tag3');
      assert.strictEqual(doc.arr[3], 'tag4');
    });
    
    const updateManyResp2 = await collection.updateMany({ key }, { $addToSet: { arr: { $each: ['tag3', 'tag4'] } } });
    assert.strictEqual(updateManyResp2.matchedCount, 5);
    assert.strictEqual(updateManyResp2.modifiedCount, 0);
    assert.strictEqual(updateManyResp2.upsertedCount, 0);
    assert.strictEqual(updateManyResp2.upsertedId, undefined);
    
    const allDocs2 = await collection.find({ key }).toArray();
    assert.strictEqual(allDocs2.length, 5);
    
    allDocs2.forEach(doc => {
      assert.strictEqual(doc.arr.length, 4);
      assert.strictEqual(doc.arr[2], 'tag3');
      assert.strictEqual(doc.arr[3], 'tag4');
    });
  });

  it('should remove last 1 item from array when $pop is passed with 1 in updateOne and updateMany', async (key) => {
    const docList = Array.from({ length: 5 }, (_, i) => ({ _id: `${key}${i}`, arr: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'], key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateOneResp = await collection.updateOne({ _id: `${key}4`, key }, { $pop: { arr: 1 } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);

    const updatedDoc = await collection.findOne({ _id: `${key}4`, key });
    assert.strictEqual(updatedDoc?.arr.length, 4);
    assert.strictEqual(updatedDoc.arr[0], 'tag1');
    assert.strictEqual(updatedDoc.arr[1], 'tag2');
    assert.strictEqual(updatedDoc.arr[2], 'tag3');
    assert.strictEqual(updatedDoc.arr[3], 'tag4');

    const updateManyResp = await collection.updateMany({ key }, { $pop: { arr: 1 } });
    assert.strictEqual(updateManyResp.matchedCount, 5);
    assert.strictEqual(updateManyResp.modifiedCount, 5);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);

    const allDocs = await collection.find({ key }).toArray();
    assert.strictEqual(allDocs.length, 5);

    allDocs.forEach(doc => {
      if (doc._id === `${key}4`) {
        assert.strictEqual(doc.arr.length, 3);
        assert.strictEqual(doc.arr[0], 'tag1');
        assert.strictEqual(doc.arr[1], 'tag2');
        assert.strictEqual(doc.arr[2], 'tag3');
      } else {
        assert.strictEqual(doc.arr.length, 4);
        assert.strictEqual(doc.arr[0], 'tag1');
        assert.strictEqual(doc.arr[1], 'tag2');
        assert.strictEqual(doc.arr[2], 'tag3');
        assert.strictEqual(doc.arr[3], 'tag4');
      }
    });
  });

  it('should remove first 1 item from array when $pop is passed with -1 in updateOne and updateMany', async (key) => {
    const docList = Array.from({ length: 5 }, (_, i) => ({ _id: `${key}${i}`, arr: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'], key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);

    const updateOneResp = await collection.updateOne({ _id: `${key}4`, key }, { $pop: { arr: -1 } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);

    const updatedDoc = await collection.findOne({ _id: `${key}4`, key });
    assert.strictEqual(updatedDoc?.arr.length, 4);
    assert.strictEqual(updatedDoc.arr[0], 'tag2');
    assert.strictEqual(updatedDoc.arr[1], 'tag3');
    assert.strictEqual(updatedDoc.arr[2], 'tag4');
    assert.strictEqual(updatedDoc.arr[3], 'tag5');

    const updateManyResp = await collection.updateMany({ key }, { $pop: { arr: -1 } });
    assert.strictEqual(updateManyResp.matchedCount, 5);
    assert.strictEqual(updateManyResp.modifiedCount, 5);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);

    const allDocs = await collection.find({ key }).toArray();
    assert.strictEqual(allDocs.length, 5);

    allDocs.forEach(doc => {
      if (doc._id === `${key}4`) {
        assert.strictEqual(doc.arr.length, 3);
        assert.strictEqual(doc.arr[0], 'tag3');
        assert.strictEqual(doc.arr[1], 'tag4');
        assert.strictEqual(doc.arr[2], 'tag5');
      } else {
        assert.strictEqual(doc.arr.length, 4);
        assert.strictEqual(doc.arr[0], 'tag2');
        assert.strictEqual(doc.arr[1], 'tag3');
        assert.strictEqual(doc.arr[2], 'tag4');
        assert.strictEqual(doc.arr[3], 'tag5');
      }
    });
  });

  it('fails gracefully on 2XX exceptions', async (key) => {
    try {
      // @ts-expect-error - testing invalid input
      await collection.updateMany({ key }, { $invalidOperator: 1 });
      assert.fail('Expected error');
    } catch (e) {
      assert.ok(e instanceof UpdateManyError);
      assert.strictEqual(e.errorDescriptors[0].errorCode, 'UNSUPPORTED_UPDATE_OPERATION');
      assert.strictEqual(e.detailedErrorDescriptors[0].errorDescriptors[0].errorCode, 'UNSUPPORTED_UPDATE_OPERATION');
      assert.strictEqual(e.errorDescriptors.length, 1);
      assert.strictEqual(e.detailedErrorDescriptors.length, 1);
      assert.deepStrictEqual(e.partialResult, { modifiedCount: 0, matchedCount: 0, upsertedCount: 0 });
    }
  });

  it('fails fast on hard errors', async (key) => {
    const collection = initCollectionWithFailingClient();
    try {
      await collection.updateMany({ key }, {});
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.ok(!(e instanceof DataAPIError));
      assert.strictEqual(e.message, 'test');
    }
  });
});
