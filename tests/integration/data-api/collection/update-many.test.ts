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

import { Collection, DataAPIError, UpdateManyError } from '@/src/data-api';
import { initCollectionWithFailingClient, initTestObjects, sampleUsersList } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.update-many', () => {
  let collection: Collection;

  before(async function () {
    [, , collection] = await initTestObjects(this);
  });

  beforeEach(async () => {
    await collection.deleteAll();
  });

  it('should updateMany documents with ids', async () => {
    const sampleDocsWithIdList = structuredClone(sampleUsersList);
    sampleDocsWithIdList[0]._id = 'docml1';
    sampleDocsWithIdList[1]._id = 'docml2';
    sampleDocsWithIdList[2]._id = 'docml3';
    const res = await collection.insertMany(sampleDocsWithIdList);
    assert.strictEqual(res.insertedCount, sampleDocsWithIdList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 3);
    const idToUpdateAndCheck = sampleDocsWithIdList[0]._id;
    const updateManyResp = await collection.updateMany({ '_id': idToUpdateAndCheck },
      {
        '$set': { 'username': 'aaronm' },
        '$unset': { 'address.city': '' }
      });
    assert.strictEqual(updateManyResp.matchedCount, 1);
    assert.strictEqual(updateManyResp.modifiedCount, 1);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ 'username': 'aaronm' });
    assert.strictEqual(updatedDoc?._id, idToUpdateAndCheck);
    assert.strictEqual(updatedDoc.username, 'aaronm');
    assert.strictEqual(updatedDoc.address?.city, undefined);
  });

  it('should update when updateMany is invoked with updates for records <= 20', async () => {
    const docList = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    const updateManyResp = await collection.updateMany({ 'city': 'nyc' },
      {
        '$set': { 'state': 'ny' }
      });
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 20);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
  });

  it('should update when updateMany is invoked with updates for records > 20', async () => {
    const docList = Array.from({ length: 101 }, () => ({ username: 'id', city: 'nyc' }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 101);
    const updateManyResp = await collection.updateMany({ 'city': 'nyc' },
      {
        '$set': { 'state': 'ny' }
      });
    assert.strictEqual(updateManyResp.matchedCount, 101);
    assert.strictEqual(updateManyResp.modifiedCount, 101);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
  });

  it('should upsert with upsert flag set to false/not set when not found', async () => {
    const docList = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    const updateManyResp = await collection.updateMany({ 'city': 'la' },
      {
        '$set': { 'state': 'ca' }
      });
    assert.strictEqual(updateManyResp.matchedCount, 0);
    assert.strictEqual(updateManyResp.modifiedCount, 0);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
  });

  it('should upsert with upsert flag set to true when not found', async () => {
    const docList = Array.from({ length: 2 }, () => ({ username: 'id', city: 'nyc' }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 2);
    const updateManyResp = await collection.updateMany({ 'city': 'la' },
      {
        '$set': { 'state': 'ca' }
      },
      {
        'upsert': true
      });
    assert.strictEqual(updateManyResp.matchedCount, 0);
    assert.strictEqual(updateManyResp.modifiedCount, 0);
    assert.strictEqual(updateManyResp.upsertedCount, 1);
    assert.ok(updateManyResp.upsertedId);
  });

  it('should increment number when $inc is used', async () => {
    const docList = Array.from({ length: 20 }, () => ({
      _id: 'id',
      username: 'username',
      city: 'trichy',
      count: 0
    }));
    docList.forEach((doc, index) => {
      doc._id += index;
      doc.count = index === 5 ? 5 : (index === 8 ? 8 : index);
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update count of 5th doc by $inc using updateOne API
    const updateOneResp = await collection.updateOne({ '_id': 'id5' }, { '$inc': { 'count': 1 } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id5' });
    assert.strictEqual(updatedDoc?.count, 6);
    //update count of 5th doc by $inc using updateMany API
    const updateManyResp = await collection.updateMany({}, { '$inc': { 'count': 1 } });
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 20);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const allDocs = await collection.find({}).toArray();
    assert.strictEqual(allDocs.length, 20);
    allDocs.forEach((doc) => {
      // noinspection SuspiciousTypeOfGuard
      assert.ok(typeof doc._id === 'string')
      const docIdNum = parseInt(doc._id.substring(2));
      if (docIdNum === 5) {
        assert.strictEqual(doc.count, 7);
      } else if (docIdNum === 8) {
        assert.strictEqual(doc.count, 9);
      } else {
        assert.strictEqual(doc.count, parseInt(doc._id.substring(2)) + 1);
      }
    });
  });

  it('should increment decimal when $inc is used', async () => {
    const docList = Array.from({ length: 20 }, () => ({
      _id: 'id',
      username: 'username',
      city: 'trichy',
      count: 0.0
    }));
    docList.forEach((doc, index) => {
      doc._id += index;
      doc.count = index === 5 ? 5.5 : (index === 8 ? 8.5 : index + 0.5);
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update count of 5th doc by $inc using updateOne API
    const updateOneResp = await collection.updateOne({ '_id': 'id5' }, { '$inc': { 'count': 1 } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id5' });
    assert.strictEqual(updatedDoc?.count, 6.5);
    //update count of 5th doc by $inc using updateMany API
    const updateManyResp = await collection.updateMany({}, { '$inc': { 'count': 1 } });
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 20);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const allDocs = await collection.find({}).toArray();
    assert.strictEqual(allDocs.length, 20);
    allDocs.forEach((doc) => {
      // noinspection SuspiciousTypeOfGuard
      assert.ok(typeof doc._id === 'string')
      const docIdNum = parseInt(doc._id.substring(2));
      if (docIdNum === 5) {
        assert.strictEqual(doc.count, 7.5);
      } else if (docIdNum === 8) {
        assert.strictEqual(doc.count, 9.5);
      } else {
        assert.strictEqual(doc.count, parseInt(doc._id.substring(2)) + 0.5 + 1);
      }
    });
  });

  it('should rename a field when $rename is used in update and updateMany', async () => {
    const docList = Array.from({ length: 20 }, () => ({
      _id: 'id',
      username: 'username',
      city: 'trichy',
      zip: 620020
    }));
    docList.forEach((doc, index) => {
      doc._id += index;
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update the doc by changing the zip field to pincode in the 5th doc using updateOne API
    const updateOneResp = await collection.updateOne({ '_id': 'id5' }, { '$rename': { 'zip': 'pincode' } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id5' });
    assert.strictEqual(updatedDoc?.pincode, 620020);
    assert.strictEqual(updatedDoc.zip, undefined);
    //update the doc by changing the zip field to pincode in all docs using updateMany API
    const updateManyResp = await collection.updateMany({}, { '$rename': { 'zip': 'pincode' } });
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 19);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const allDocs = await collection.find({}).toArray();
    assert.strictEqual(allDocs.length, 20);
    allDocs.forEach((doc) => {
      assert.strictEqual(doc.pincode, 620020);
      assert.strictEqual(doc.zip, undefined);
    });
  });

  it('should rename a sub doc field when $rename is used in update and updateMany', async () => {
    const docList = Array.from({ length: 20 }, () => ({
      _id: 'id',
      username: 'username',
      address: { zip: 620020, city: 'trichy' }
    }));
    docList.forEach((doc, index) => {
      doc._id += index;
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update the doc by changing the zip field to pincode in the 5th doc using updateOne API
    const updateOneResp = await collection.updateOne({ '_id': 'id5' }, { '$rename': { 'address.zip': 'address.pincode' } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id5' });
    assert.strictEqual(updatedDoc?.address?.pincode, 620020);
    assert.strictEqual(updatedDoc.address.zip, undefined);
    //update the doc by changing the zip field to pincode in all docs using updateMany API
    const updateManyResp = await collection.updateMany({}, { '$rename': { 'address.zip': 'address.pincode' } });
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 19);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const allDocs = await collection.find({}).toArray();
    assert.strictEqual(allDocs.length, 20);
    allDocs.forEach((doc) => {
      assert.strictEqual(doc.address?.pincode, 620020);
      assert.strictEqual(doc.address.zip, undefined);
    });
  });

  it('should set date to current date in the fields inside $currentDate in update and updateMany', async () => {
    const docList = Array.from({ length: 20 }, () => ({ _id: 'id', username: 'username' }));
    docList.forEach((doc, index) => {
      doc._id += index;
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update the doc by setting the date field to current date in the 5th doc using updateOne API
    const updateOneResp = await collection.updateOne({ '_id': 'id5' }, { '$currentDate': { 'createdAt': true } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id5' });
    assert.ok(updatedDoc?.createdAt);
    //update the doc by setting the date field to current date in all docs using updateMany API
    const updateManyResp = await collection.updateMany({}, { '$currentDate': { 'createdAt': true } });
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 20);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const allDocs = await collection.find({}).toArray();
    assert.strictEqual(allDocs.length, 20);
    allDocs.forEach((doc) => {
      assert.ok(doc.createdAt);
    });
  });

  it('should set fields under $setOnInsert when upsert is true in updateOne', async () => {
    const docList = Array.from({ length: 20 }, () => ({ _id: 'id', username: 'username', city: 'trichy' }));
    docList.forEach((doc, index) => {
      doc._id += index;
    });
    //insert all docs
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update the 5th doc using updateOne API with upsert true and $setOnInsert field with a new field and value
    const updateOneResp = await collection.updateOne({ '_id': 'id5' }, {
      '$set': { 'country': 'India' },
      '$setOnInsert': { 'pincode': 620020 },
    }, { 'upsert': true });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id5' });
    //assert that the pincode field is not set in the 5th doc because the fields under $setOnInsert are set only when the doc is inserted
    assert.strictEqual(updatedDoc?.pincode, undefined);
    assert.strictEqual(updatedDoc?.country, 'India');
    //update doc with invalid id using updateOne API with upsert true and $setOnInsert field with a new field and value
    const updateOneResp1 = await collection.updateOne({ '_id': 'id21' }, {
      '$set': { 'country': 'India' },
      '$setOnInsert': { 'pincode': 620020 }
    }, { 'upsert': true });
    assert.strictEqual(updateOneResp1.matchedCount, 0);
    assert.strictEqual(updateOneResp1.modifiedCount, 0);
    assert.strictEqual(updateOneResp1.upsertedCount, 1);
    assert.strictEqual(updateOneResp1.upsertedId, 'id21');
    const updatedDoc1 = await collection.findOne({ '_id': 'id21' });
    //assert that the pincode field is set in the 21st doc because the fields under $setOnInsert are set only when the doc is inserted
    assert.strictEqual(updatedDoc1?.pincode, 620020);
    assert.strictEqual(updatedDoc1.country, 'India');
  });

  it('should set fields under $setOnInsert when upsert is true in updateMany', async () => {
    const docList = Array.from({ length: 20 }, () => ({ _id: 'id', username: 'username', city: 'trichy' }));
    docList.forEach((doc, index) => {
      doc._id += index;
    });
    //insert all docs
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update the 5th doc using updateMany API with upsert true and $setOnInsert field with a new field and value
    const updateManyResp = await collection.updateMany({ '_id': 'id5' }, {
      '$set': { 'country': 'India' },
      '$setOnInsert': { 'pincode': 620020 }
    }, { 'upsert': true });
    assert.strictEqual(updateManyResp.matchedCount, 1);
    assert.strictEqual(updateManyResp.modifiedCount, 1);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id5' });
    //assert that the pincode field is not set in the 5th doc because the fields under $setOnInsert are set only when the doc is inserted
    assert.strictEqual(updatedDoc?.pincode, undefined);
    assert.strictEqual(updatedDoc?.country, 'India');
    //update doc with invalid id using updateMany API with upsert true and $setOnInsert field with a new field and value
    const updateManyResp1 = await collection.updateMany({ '_id': 'id21' }, {
      '$set': { 'country': 'India' },
      '$setOnInsert': { 'pincode': 620020 }
    }, { 'upsert': true });
    assert.strictEqual(updateManyResp1.matchedCount, 0);
    assert.strictEqual(updateManyResp1.modifiedCount, 0);
    assert.strictEqual(updateManyResp1.upsertedCount, 1);
    assert.strictEqual(updateManyResp1.upsertedId, 'id21');
    const updatedDoc1 = await collection.findOne({ '_id': 'id21' });
    //assert that the pincode field is set in the 21st doc because the fields under $setOnInsert are set only when the doc is inserted
    assert.strictEqual(updatedDoc1?.pincode, 620020);
    assert.strictEqual(updatedDoc1.country, 'India');
  });

  it('should set a field value to new value when the new value is < existing value with $min in updateOne and updateMany', async () => {
    const docList = Array.from({ length: 20 }, () => ({
      _id: 'id',
      minScore: 50,
      maxScore: 800
    }));
    docList.forEach((doc, index) => {
      doc._id += index;
      if (index == 4) {
        doc.minScore = 10;
      }
    });
    //insert all docs
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update the 4th doc using updateOne API with $min operator to set the minScore to 5
    const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$min': { 'minScore': 5 } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id4' });
    //assert that the minScore field is set to 5 in the 4th doc because the $min operator sets the field value to new value when the new value is less than existing value
    assert.strictEqual(updatedDoc?.minScore, 5);
    //update the 4th doc using updateOne API with $min operator to set the minScore to 15
    const updateOneResp1 = await collection.updateOne({ '_id': 'id4' }, { '$min': { 'minScore': 15 } });
    assert.strictEqual(updateOneResp1.matchedCount, 1);
    assert.strictEqual(updateOneResp1.modifiedCount, 0);
    assert.strictEqual(updateOneResp1.upsertedCount, 0);
    assert.strictEqual(updateOneResp1.upsertedId, undefined);
    const updatedDoc1 = await collection.findOne({ '_id': 'id4' });
    //assert that the minScore field is not set to 15 in the 5th doc because the $min operator does not set the field value to new value when the new value is greater than existing value
    assert.strictEqual(updatedDoc1?.minScore, 5);
    //update all docs using updateMany API with $min operator to set the minScore to 15
    const updateManyResp = await collection.updateMany({}, { '$min': { 'minScore': 15 } });
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 19);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const allDocs = await collection.find({}).toArray();
    //assert that the minScore field is set to 15 in all docs because the $min operator sets the field value to new value when the new value is less than existing value
    allDocs.forEach(doc => {
      if (doc._id === 'id4') {
        assert.strictEqual(doc.minScore, 5);
      } else {
        assert.strictEqual(doc.minScore, 15);
      }
    });
    //update all docs using updateMany API with $min operator to set the minScore to 50
    const updateManyResp1 = await collection.updateMany({}, { '$min': { 'minScore': 50 } });
    assert.strictEqual(updateManyResp1.matchedCount, 20);
    assert.strictEqual(updateManyResp1.modifiedCount, 0);
    assert.strictEqual(updateManyResp1.upsertedCount, 0);
    assert.strictEqual(updateManyResp1.upsertedId, undefined);
    const allDocs1 = await collection.find({}).toArray();
    //assert that the minScore field is not set to 50 in all docs because the $min operator does not set the field value to new value when the new value is greater than existing value
    allDocs1.forEach(doc => {
      if (doc._id === 'id4') {
        assert.strictEqual(doc.minScore, 5);
      } else {
        assert.strictEqual(doc.minScore, 15);
      }
    });
  });

  it('should set a field value to new value when the new value is > existing value with $max in updateOne and updateMany', async () => {
    const docList = Array.from({ length: 20 }, () => ({
      _id: 'id',
      minScore: 50,
      maxScore: 800
    }));
    docList.forEach((doc, index) => {
      doc._id += index;
      if (index == 4) {
        doc.maxScore = 900;
      }
    });
    //insert all docs
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update the 4th doc using updateOne API with $max operator to set the maxScore to 5
    const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$max': { 'maxScore': 950 } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id4' });
    //assert that the maxScore field is set to 950 in the 4th doc because the $max operator sets the field value to new value when the new value is greater than existing value
    assert.strictEqual(updatedDoc?.maxScore, 950);
    //update the 4th doc using updateOne API with $max operator to set the maxScore to 15
    const updateOneResp1 = await collection.updateOne({ '_id': 'id4' }, { '$max': { 'maxScore': 15 } });
    assert.strictEqual(updateOneResp1.matchedCount, 1);
    assert.strictEqual(updateOneResp1.modifiedCount, 0);
    assert.strictEqual(updateOneResp1.upsertedCount, 0);
    assert.strictEqual(updateOneResp1.upsertedId, undefined);
    const updatedDoc1 = await collection.findOne({ '_id': 'id4' });
    //assert that the maxScore field is not set to 15 in the 5th doc because the $max operator does not set the field value to new value when the new value is lesser than existing value
    assert.strictEqual(updatedDoc1?.maxScore, 950);
    //update all docs using updateMany API with $max operator to set the maxScore to 15
    const updateManyResp = await collection.updateMany({}, { '$max': { 'maxScore': 900 } });
    assert.strictEqual(updateManyResp.matchedCount, 20);
    assert.strictEqual(updateManyResp.modifiedCount, 19);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const allDocs = await collection.find({}).toArray();
    //assert that the maxScore field is set to 900 in all docs because the $max operator sets the field value to new value when the new value is greater than existing value
    allDocs.forEach(doc => {
      if (doc._id === 'id4') {
        assert.strictEqual(doc.maxScore, 950);
      } else {
        assert.strictEqual(doc.maxScore, 900);
      }
    });
    //update all docs using updateMany API with $max operator to set the maxScore to 50
    const updateManyResp1 = await collection.updateMany({}, { '$max': { 'maxScore': 50 } });
    assert.strictEqual(updateManyResp1.matchedCount, 20);
    assert.strictEqual(updateManyResp1.modifiedCount, 0);
    assert.strictEqual(updateManyResp1.upsertedCount, 0);
    assert.strictEqual(updateManyResp1.upsertedId, undefined);
    const allDocs1 = await collection.find({}).toArray();
    //assert that the maxScore field is not set to 50 in all docs because the $max operator does not set the field value to new value when the new value is less than existing value
    allDocs1.forEach(doc => {
      if (doc._id === 'id4') {
        assert.strictEqual(doc.maxScore, 950);
      } else {
        assert.strictEqual(doc.maxScore, 900);
      }
    });
  });

  it('should multiply a value by number provided for each field in the $mul in updateOne and updateMany', async () => {
    const docList = Array.from({ length: 5 }, () => ({
      _id: 'id',
      price: 50,
      njStatePrice: 50
    }));
    docList.forEach((doc, index) => {
      doc._id += index;
    });
    //insert all docs
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update the 4th doc using updateOne API with $mul operator to multiply the njStatePrice by 1.07
    const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$mul': { 'njStatePrice': 1.07 } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id4' });
    //assert that the njStatePrice field is multiplied by 1.07 in the 4th doc because the $mul operator multiplies the field value by new value
    assert.strictEqual(updatedDoc?.njStatePrice, 53.5);
    //update docs using updateMany API with $mul operator to multiply the njStatePrice by 1.07
    const updateManyResp = await collection.updateMany({ '_id': { '$in': ['id0', 'id1', 'id2', 'id3'] } }, { '$mul': { 'njStatePrice': 1.07 } });
    assert.strictEqual(updateManyResp.matchedCount, 4);
    assert.strictEqual(updateManyResp.modifiedCount, 4);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const allDocs = await collection.find({}).toArray();
    //assert that the njStatePrice field is multiplied by 1.07 in all docs because the $mul operator multiplies the field value by new value
    allDocs.forEach(doc => {
      assert.strictEqual(doc.njStatePrice, 53.5);
    });
  });

  it('should push an element to an array when an item is added using $push', async () => {
    const docList = Array.from({ length: 5 }, () => ({ _id: 'id', productName: 'prod', tags: ['tag1', 'tag2'] }));
    docList.forEach((doc, index) => {
      doc._id += index;
    });
    //insert all docs
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update the 4th doc using updateOne API with $push operator to push the tag3 to the tags array
    const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$push': { 'tags': 'tag3' } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id4' });
    //assert that the tag3 is pushed to the tags array in the 4th doc because the $push operator pushes the item to the array
    assert.strictEqual(updatedDoc?.tags.length, 3);
    assert.strictEqual(updatedDoc.tags[2], 'tag3');
    //update docs using updateMany API with $push operator to push the tag3 to the tags array
    const updateManyResp = await collection.updateMany({}, { '$push': { 'tags': 'tag3' } });
    assert.strictEqual(updateManyResp.matchedCount, 5);
    assert.strictEqual(updateManyResp.modifiedCount, 5);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const allDocs = await collection.find({}).toArray();
    assert.strictEqual(allDocs.length, 5);
    //assert that the tag3 is pushed to the tags array in all docs because the $push operator pushes the item to the array
    allDocs.forEach(doc => {
      if (doc._id === 'id4') {
        assert.strictEqual(doc.tags.length, 4);
        assert.strictEqual(doc.tags[2], 'tag3');
        assert.strictEqual(doc.tags[3], 'tag3');
      } else {
        assert.strictEqual(doc.tags.length, 3);
        assert.strictEqual(doc.tags[2], 'tag3');
      }
    });
  });

  it('should push an element to an array when each item in $each is added using $push with $position', async () => {
    const docList = Array.from({ length: 5 }, () => ({ _id: 'id', productName: 'prod', tags: ['tag1', 'tag2'] }));
    docList.forEach((doc, index) => {
      doc._id += index;
    });
    //insert all docs
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update the 4th doc using updateOne API with $push operator to push the tag3 and tag4 to the tags array at position 1
    const updateOneResp = await collection.updateOne({ '_id': 'id4' }, {
      '$push': {
        'tags': {
          '$each': ['tag3', 'tag4'],
          '$position': 1
        }
      }
    });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id4' });
    //assert that the tag3 and tag4 are pushed to the tags array in the 4th doc at position 1 because the $push operator pushes the item to the array
    assert.strictEqual(updatedDoc?.tags.length, 4);
    assert.strictEqual(updatedDoc.tags[1], 'tag3');
    assert.strictEqual(updatedDoc.tags[2], 'tag4');
    //update docs using updateMany API with $push operator to push the tag3 and tag4 to the tags array at position 1
    const updateManyResp = await collection.updateMany({}, {
      '$push': {
        'tags': {
          '$each': ['tag3', 'tag4'],
          '$position': 1
        }
      }
    });
    assert.strictEqual(updateManyResp.matchedCount, 5);
    assert.strictEqual(updateManyResp.modifiedCount, 5);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const allDocs = await collection.find({}).toArray();
    assert.strictEqual(allDocs.length, 5);
    //assert that the tag3 and tag4 are pushed to the tags array in all docs at position 1 because the $push operator pushes the item to the array
    allDocs.forEach(doc => {
      if (doc._id === 'id4') {
        assert.strictEqual(doc.tags.length, 6);
        assert.strictEqual(doc.tags[1], 'tag3');
        assert.strictEqual(doc.tags[2], 'tag4');
        assert.strictEqual(doc.tags[3], 'tag3');
        assert.strictEqual(doc.tags[4], 'tag4');
      } else {
        assert.strictEqual(doc.tags.length, 4);
        assert.strictEqual(doc.tags[1], 'tag3');
        assert.strictEqual(doc.tags[2], 'tag4');
      }
    });
  });

  it('should push an element to an array skipping duplicates when an item is added using $addToSet', async () => {
    const docList = Array.from({ length: 5 }, () => ({ _id: 'id', productName: 'prod', tags: ['tag1', 'tag2'] }));
    docList.forEach((doc, index) => {
      doc._id += index;
    });
    //insert all docs
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update the 4th doc using updateOne API with $addToSet operator to add the tag3 to the tags array
    const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$addToSet': { 'tags': 'tag3' } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id4' });
    //assert that the tag3 is added to the tags array in the 4th doc because the $addToSet operator adds the item to the array
    assert.strictEqual(updatedDoc?.tags.length, 3);
    assert.strictEqual(updatedDoc.tags[2], 'tag3');
    //update 4th doc using updateOne API with $addToSet operator to add the tag3 to the tags array again and this should be a no-op
    const updateOneResp2 = await collection.updateOne({ '_id': 'id4' }, { '$addToSet': { 'tags': 'tag3' } });
    assert.strictEqual(updateOneResp2.matchedCount, 1);
    assert.strictEqual(updateOneResp2.modifiedCount, 0);
    assert.strictEqual(updateOneResp2.upsertedCount, 0);
    assert.strictEqual(updateOneResp2.upsertedId, undefined);
    const updatedDoc2 = await collection.findOne({ '_id': 'id4' });
    //assert that the tag3 is not added to the tags array in the 4th doc because the $addToSet operator does not add the item to the array if it already exists
    assert.strictEqual(updatedDoc2?.tags.length, 3);
    assert.strictEqual(updatedDoc2.tags[2], 'tag3');
    //update docs using updateMany API with $addToSet operator to add the tag3 to the tags array
    const updateManyResp = await collection.updateMany({}, { '$addToSet': { 'tags': 'tag3' } });
    assert.strictEqual(updateManyResp.matchedCount, 5);
    assert.strictEqual(updateManyResp.modifiedCount, 4);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const allDocs = await collection.find({}).toArray();
    assert.strictEqual(allDocs.length, 5);
    //assert that the tag3 is added to the tags array in all docs because the $addToSet operator adds the item to the array
    allDocs.forEach(doc => {
      assert.strictEqual(doc.tags.length, 3);
      assert.strictEqual(doc.tags[2], 'tag3');
    });
    //update docs using updateMany API with $addToSet operator to add the tag3 to the tags array again and this should be a no-op
    const updateManyResp2 = await collection.updateMany({}, { '$addToSet': { 'tags': 'tag3' } });
    assert.strictEqual(updateManyResp2.matchedCount, 5);
    assert.strictEqual(updateManyResp2.modifiedCount, 0);
    assert.strictEqual(updateManyResp2.upsertedCount, 0);
    assert.strictEqual(updateManyResp2.upsertedId, undefined);
    const allDocs2 = await collection.find({}).toArray();
    assert.strictEqual(allDocs2.length, 5);
    //assert that the tag3 is not added to the tags array in all docs because the $addToSet operator does not add the item to the array if it already exists
    allDocs2.forEach(doc => {
      assert.strictEqual(doc.tags.length, 3);
      assert.strictEqual(doc.tags[2], 'tag3');
    });
  });

  it('should push an element to an array skipping duplicates when an item is added using $addToSet with $each', async () => {
    const docList = Array.from({ length: 5 }, () => ({ _id: 'id', productName: 'prod', tags: ['tag1', 'tag2'] }));
    docList.forEach((doc, index) => {
      doc._id += index;
    });
    //insert all docs
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update the 4th doc using updateOne API with $addToSet operator to add the tag3 and tag4 to the tags array
    const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$addToSet': { 'tags': { '$each': ['tag3', 'tag4'] } } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id4' });
    //assert that the tag3 and tag4 added to the tags array in the 4th doc because the $addToSet operator adds the item to the array
    assert.strictEqual(updatedDoc?.tags.length, 4);
    assert.strictEqual(updatedDoc.tags[2], 'tag3');
    assert.strictEqual(updatedDoc.tags[3], 'tag4');
    //update 4th doc using updateOne API with $addToSet operator to add the tag3 and tab4 to the tags array again and this should be a no-op
    const updateOneResp2 = await collection.updateOne({ '_id': 'id4' }, { '$addToSet': { 'tags': { '$each': ['tag3', 'tag4'] } } });
    assert.strictEqual(updateOneResp2.matchedCount, 1);
    assert.strictEqual(updateOneResp2.modifiedCount, 0);
    assert.strictEqual(updateOneResp2.upsertedCount, 0);
    assert.strictEqual(updateOneResp2.upsertedId, undefined);
    await collection.findOne({ '_id': 'id4' });
    //assert that the tag3 and tag4 are not added to the tags array in the 4th doc because the $addToSet operator does not add the item to the array if it already exists
    assert.strictEqual(updatedDoc.tags.length, 4);
    assert.strictEqual(updatedDoc.tags[2], 'tag3');
    assert.strictEqual(updatedDoc.tags[3], 'tag4');
    //update docs using updateMany API with $addToSet operator to add the tag3 and tag4 to the tags array
    const updateManyResp = await collection.updateMany({}, { '$addToSet': { 'tags': { '$each': ['tag3', 'tag4'] } } });
    assert.strictEqual(updateManyResp.matchedCount, 5);
    assert.strictEqual(updateManyResp.modifiedCount, 4);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const allDocs = await collection.find({}).toArray();
    assert.strictEqual(allDocs.length, 5);
    //assert that the tag3 and tag4 are added to the tags array in all docs because the $addToSet operator adds the item to the array
    allDocs.forEach(doc => {
      assert.strictEqual(doc.tags.length, 4);
      assert.strictEqual(doc.tags[2], 'tag3');
      assert.strictEqual(doc.tags[3], 'tag4');
    });
    //update docs using updateMany API with $addToSet operator to add the tag3 and tag4 to the tags array again and this should be a no-op
    const updateManyResp2 = await collection.updateMany({}, { '$addToSet': { 'tags': { '$each': ['tag3', 'tag4'] } } });
    assert.strictEqual(updateManyResp2.matchedCount, 5);
    assert.strictEqual(updateManyResp2.modifiedCount, 0);
    assert.strictEqual(updateManyResp2.upsertedCount, 0);
    assert.strictEqual(updateManyResp2.upsertedId, undefined);
    const allDocs2 = await collection.find({}).toArray();
    assert.strictEqual(allDocs2.length, 5);
    //assert that the tag3 & tag4 are not added to the tags array in all docs because the $addToSet operator does not add the item to the array if it already exists
    allDocs2.forEach(doc => {
      assert.strictEqual(doc.tags.length, 4);
      assert.strictEqual(doc.tags[2], 'tag3');
      assert.strictEqual(doc.tags[3], 'tag4');
    });
  });

  it('should remove last 1 item from array when $pop is passed with 1 in updateOne and updateMany', async () => {
    const docList = Array.from({ length: 5 }, () => ({
      _id: 'id',
      productName: 'prod',
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']
    }));
    docList.forEach((doc, index) => {
      doc._id += index;
    });
    //insert all docs
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update the 4th doc using updateOne API with $pop operator to remove the last 1 item from the tags array
    const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$pop': { 'tags': 1 } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id4' });
    //assert that the last 2 items are removed from the tags array in the 4th doc because the $pop operator removes the items from the array
    assert.strictEqual(updatedDoc?.tags.length, 4);
    assert.strictEqual(updatedDoc.tags[0], 'tag1');
    assert.strictEqual(updatedDoc.tags[1], 'tag2');
    assert.strictEqual(updatedDoc.tags[2], 'tag3');
    assert.strictEqual(updatedDoc.tags[3], 'tag4');
    //update docs using updateMany API with $pop operator to remove the last 1 item from the tags array
    const updateManyResp = await collection.updateMany({}, { '$pop': { 'tags': 1 } });
    assert.strictEqual(updateManyResp.matchedCount, 5);
    assert.strictEqual(updateManyResp.modifiedCount, 5);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const allDocs = await collection.find({}).toArray();
    assert.strictEqual(allDocs.length, 5);
    //assert that the last 2 items are removed from the tags array in all docs because the $pop operator removes the items from the array
    allDocs.forEach(doc => {
      if (doc._id === 'id4') {
        assert.strictEqual(doc.tags.length, 3);
        assert.strictEqual(doc.tags[0], 'tag1');
        assert.strictEqual(doc.tags[1], 'tag2');
        assert.strictEqual(doc.tags[2], 'tag3');
      } else {
        assert.strictEqual(doc.tags.length, 4);
        assert.strictEqual(doc.tags[0], 'tag1');
        assert.strictEqual(doc.tags[1], 'tag2');
        assert.strictEqual(doc.tags[2], 'tag3');
        assert.strictEqual(doc.tags[3], 'tag4');
      }
    });
  });

  it('should remove first 1 item from array when $pop is passed with -1 in updateOne and updateMany', async () => {
    const docList = Array.from({ length: 5 }, () => ({
      _id: 'id',
      productName: 'prod',
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']
    }));
    docList.forEach((doc, index) => {
      doc._id += index;
    });
    //insert all docs
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
    //update the 4th doc using updateOne API with $pop operator to remove the first 1 item from the tags array
    const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$pop': { 'tags': -1 } });
    assert.strictEqual(updateOneResp.matchedCount, 1);
    assert.strictEqual(updateOneResp.modifiedCount, 1);
    assert.strictEqual(updateOneResp.upsertedCount, 0);
    assert.strictEqual(updateOneResp.upsertedId, undefined);
    const updatedDoc = await collection.findOne({ '_id': 'id4' });
    //assert that the last 2 items are removed from the tags array in the 4th doc because the $pop operator removes the items from the array
    assert.strictEqual(updatedDoc?.tags.length, 4);
    assert.strictEqual(updatedDoc.tags[0], 'tag2');
    assert.strictEqual(updatedDoc.tags[1], 'tag3');
    assert.strictEqual(updatedDoc.tags[2], 'tag4');
    assert.strictEqual(updatedDoc.tags[3], 'tag5');
    //update docs using updateMany API with $pop operator to remove the first 1 item from the tags array
    const updateManyResp = await collection.updateMany({}, { '$pop': { 'tags': -1 } });
    assert.strictEqual(updateManyResp.matchedCount, 5);
    assert.strictEqual(updateManyResp.modifiedCount, 5);
    assert.strictEqual(updateManyResp.upsertedCount, 0);
    assert.strictEqual(updateManyResp.upsertedId, undefined);
    const allDocs = await collection.find({}).toArray();
    assert.strictEqual(allDocs.length, 5);
    //assert that the last 2 items are removed from the tags array in all docs because the $pop operator removes the items from the array
    allDocs.forEach(doc => {
      if (doc._id === 'id4') {
        assert.strictEqual(doc.tags.length, 3);
        assert.strictEqual(doc.tags[0], 'tag3');
        assert.strictEqual(doc.tags[1], 'tag4');
        assert.strictEqual(doc.tags[2], 'tag5');
      } else {
        assert.strictEqual(doc.tags.length, 4);
        assert.strictEqual(doc.tags[0], 'tag2');
        assert.strictEqual(doc.tags[1], 'tag3');
        assert.strictEqual(doc.tags[2], 'tag4');
        assert.strictEqual(doc.tags[3], 'tag5');
      }
    });
  });

  it('fails gracefully on 2XX exceptions', async () => {
    try {
      // @ts-expect-error - testing invalid input
      await collection.updateMany({}, { $invalidOperator: 1 })
      assert.fail('Expected error');
    } catch (e) {
      assert.ok(e instanceof UpdateManyError);
      assert.strictEqual(e.errorDescriptors[0].errorCode, 'UNSUPPORTED_UPDATE_OPERATION');
      assert.strictEqual(e.detailedErrorDescriptors[0].errorDescriptors[0].errorCode, 'UNSUPPORTED_UPDATE_OPERATION');
      assert.strictEqual(e.errorDescriptors.length, 1);
      assert.strictEqual(e.detailedErrorDescriptors.length, 1);
      assert.deepStrictEqual(e.partialResult, { modifiedCount: 0, matchedCount: 0, upsertedCount: 0 });
      assert.deepStrictEqual(e.errorDescriptors[0].attributes, {});
    }
  });

  it('fails fast on hard errors', async function () {
    const collection = await initCollectionWithFailingClient(this);
    try {
      await collection.updateMany({}, {});
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.ok(!(e instanceof DataAPIError));
      assert.strictEqual(e.message, 'test');
    }
  });
});
