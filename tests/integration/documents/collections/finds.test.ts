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

import {
  createSampleDoc2WithMultiLevel,
  createSampleDoc3WithMultiLevel,
  createSampleDocWithMultiLevel,
  it,
  parallel,
} from '@/tests/testlib';
import assert from 'assert';

// I was going to go through split this up but yeah... no
// Don't want to spend too much time sifting through a thousand lines of intertwined tests
parallel('integration.documents.collections.finds', { truncate: 'colls:before' }, ({ collection, collection_ }) => {
  it('should find & findOne document with an empty filter', async (key) => {
    const { insertedId } = await collection_.insertOne({ key });

    for (const filter of [null, undefined, {}]) {
      const resDoc = await collection_.findOne(filter!);
      assert.deepStrictEqual(resDoc, { _id: insertedId, key });
      const resArr = await collection_.find(filter!).toArray();
      assert.deepStrictEqual(resArr, [{ _id: insertedId, key }]);
    }
  });

  it('should find & findOne document', async (key) => {
    const insertDocResp = await collection.insertOne(createSampleDocWithMultiLevel(key));
    const idToCheck = insertDocResp.insertedId;
    const filter = { '_id': idToCheck, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne document with projection', async (key) => {
    const insertDocResp = await collection.insertOne(createSampleDocWithMultiLevel(key));
    const idToCheck = insertDocResp.insertedId;
    const filter = { '_id': idToCheck, key };
    const resDoc = await collection.findOne(filter, { projection: { username: 1 } });
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    assert.strictEqual(resDoc.username, 'aaron');
    assert.strictEqual(resDoc.age, undefined);
    const findResDocs = await collection.find(filter, { projection: { username: 1 } }).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
    assert.strictEqual(findResDocs[0].username, 'aaron');
    assert.strictEqual(findResDocs[0].age, undefined);
  });

  it('should find with sort', async (key) => {
    await collection.insertMany([
      { username: 'a', key },
      { username: 'c', key },
      { username: 'b', key },
    ]);

    let docs = await collection.find({ key }, { sort: { username: 1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.username), ['a', 'b', 'c']);

    docs = await collection.find({ key }, { sort: { username: -1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.username), ['c', 'b', 'a']);
  });

  it('should findOne with sort', async (key) => {
    await collection.insertMany([
      { username: 'a', key },
      { username: 'c', key },
      { username: 'b', key },
    ]);

    let doc = await collection.findOne({ key }, { sort: { username: 1 } });
    assert.strictEqual(doc?.username, 'a');

    doc = await collection.findOne({ key }, { sort: { username: -1 } });
    assert.deepStrictEqual(doc?.username, 'c');
  });

  it('should find with multiple, and different, sorts', async (key) => {
    await collection.insertMany([
      { username: 'a', age: 1, key },
      { username: 'a', age: 3, key },
      { username: 'a', age: 2, key },
    ]);

    let docs = await collection.find({ key }, { sort: { username: 1, age: 1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.age), [1, 2, 3]);

    docs = await collection.find({ key }, { sort: { username: 1, age: -1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.age), [3, 2, 1]);

    docs = await collection.find({ key }, { sort: { username: -1, age: 1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.age), [1, 2, 3]);

    docs = await collection.find({ key }, { sort: { username: -1, age: -1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.age), [3, 2, 1]);
  });

  it('should find & findOne eq document', async (key) => {
    const insertDocResp = await collection.insertOne(createSampleDocWithMultiLevel(key));
    const idToCheck = insertDocResp.insertedId;
    const filter = { '_id': { '$eq': idToCheck }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne ne document', async (key) => {
    const insertDocResp1 = await collection.insertOne(createSampleDocWithMultiLevel(key));
    const insertDocResp2 = await collection.insertOne(createSampleDoc2WithMultiLevel(key));
    const idToCheck1 = insertDocResp1.insertedId;
    const idToCheck2 = insertDocResp2.insertedId;
    const filter = { '_id': { '$ne': idToCheck1 }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck2);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck2);

    const filter1 = { '_id': { '$ne': idToCheck2 }, key };
    const resDoc1 = await collection.findOne(filter1);
    assert.ok(resDoc1);
    assert.strictEqual(resDoc1._id, idToCheck1);
    const findResDocs1 = await collection.find(filter1).toArray();
    assert.strictEqual(findResDocs1.length, 1);
    assert.strictEqual(findResDocs1[0]._id, idToCheck1);
  });

  it('should find & findOne L1 String EQ document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'username': doc.username, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne L1 String EQ $eq document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'username': { '$eq': doc.username }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne L1 String NE $ne document', async (key) => {
    const doc1 = createSampleDocWithMultiLevel(key);
    const doc2 = createSampleDoc2WithMultiLevel(key);
    await collection.insertOne(doc1);
    const insertDocResp2 = await collection.insertOne(doc2);
    const idToCheck2 = insertDocResp2.insertedId;
    const filter = { 'username': { '$ne': doc1.username }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck2);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck2);
  });

  it('should find & findOne L1 Number EQ document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'age': doc.age, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne L1 Number EQ $eq document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'age': { '$eq': doc.age }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne L1 Number NE $ne document', async (key) => {
    const doc1 = createSampleDocWithMultiLevel(key);
    const doc2 = createSampleDoc2WithMultiLevel(key);
    await collection.insertOne(doc1);
    const insertDocResp2 = await collection.insertOne(doc2);
    const idToCheck2 = insertDocResp2.insertedId;
    const filter = { 'age': { '$ne': doc1.age }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck2);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck2);
  });

  it('should find & findOne L1 Boolean EQ document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'human': doc.human, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne L1 Boolean EQ $eq document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'human': { '$eq': doc.human }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne L1 Boolean NE $ne document', async (key) => {
    const doc1 = createSampleDoc2WithMultiLevel(key);
    const doc2 = createSampleDoc3WithMultiLevel(key);
    const insertDocResp1 = await collection.insertOne(doc1);
    await collection.insertOne(doc2);
    const idToCheck1 = insertDocResp1.insertedId;
    const filter = { 'human': { '$ne': false }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck1);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck1);
  });

  it('should find & findOne L1 Null EQ document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'password': null, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne L1 Null EQ $eq document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'password': { '$eq': null }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne L1 Null NE $ne document', async (key) => {
    const doc1 = createSampleDocWithMultiLevel(key);
    const doc2 = createSampleDoc2WithMultiLevel(key);
    await collection.insertOne(doc1);
    const insertDocResp2 = await collection.insertOne(doc2);
    const idToCheck2 = insertDocResp2.insertedId;
    const filter = { 'password': { '$ne': doc1.password }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck2);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck2);
  });

  it('should find & findOne any level String EQ document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'address.street': doc.address?.street, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne any level String EQ $eq document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'address.street': { '$eq': doc.address?.street }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne any level String NE $ne document', async (key) => {
    const doc1 = createSampleDocWithMultiLevel(key);
    const doc2 = createSampleDoc2WithMultiLevel(key);
    const insertDocResp1 = await collection.insertOne(doc1);
    await collection.insertOne(doc2);
    const idToCheck1 = insertDocResp1.insertedId;
    const filter = { 'address.street': { '$ne': doc2.address?.street }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck1);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck1);
  });

  it('should find & findOne any level Number EQ document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'address.number': doc.address?.number, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should findOne any level Number EQ $eq document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'address.number': { '$eq': doc.address?.number }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne any level Number NE $ne document', async (key) => {
    const doc1 = createSampleDocWithMultiLevel(key);
    const doc2 = createSampleDoc2WithMultiLevel(key);
    await collection.insertOne(doc1);
    const insertDocResp2 = await collection.insertOne(doc2);
    const idToCheck2 = insertDocResp2.insertedId;
    const filter = { 'address.number': { '$ne': doc1.address?.number }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck2);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck2);
  });

  it('should find & findOne any level Boolean EQ document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'address.is_office': doc.address?.is_office, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne any level Boolean EQ $eq document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'address.is_office': { '$eq': doc.address?.is_office }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne any level Boolean NE $ne document', async (key) => {
    const doc1 = createSampleDocWithMultiLevel(key);
    const doc2 = createSampleDoc2WithMultiLevel(key);
    await collection.insertOne(doc1);
    const insertDocResp2 = await collection.insertOne(doc2);
    const idToCheck2 = insertDocResp2.insertedId;
    const filter = { 'address.is_office': { '$ne': doc1.address?.is_office }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck2);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck2);
  });

  it('should find & findOne any level Null EQ document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'address.suburb': doc.address?.suburb, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne any level Null EQ $eq document', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'address.suburb': { '$eq': doc.address?.suburb }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne any level Null EQ $ne document', async (key) => {
    const doc1 = createSampleDocWithMultiLevel(key);
    const doc2 = createSampleDoc2WithMultiLevel(key);
    await collection.insertOne(doc1);
    const insertDocResp2 = await collection.insertOne(doc2);
    const idToCheck2 = insertDocResp2.insertedId;
    const filter = { 'address.suburb': { '$ne': doc1.address?.suburb }, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck2);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck2);
  });

  it('should find & findOne multiple top level conditions', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { age: doc.age, human: doc.human, password: doc.password, key };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne multiple level>=2 conditions', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = {
      'address.number': doc.address?.number,
      'address.street': doc.address?.street,
      'address.is_office': doc.address?.is_office,
      key,
    };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne multiple mixed levels conditions', async (key) => {
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = {
      'age': doc.age,
      'address.street': doc.address?.street,
      'address.is_office': doc.address?.is_office,
      key,
    };
    const findOneResDoc = await collection.findOne(filter);
    assert.ok(findOneResDoc);
    assert.strictEqual(findOneResDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find doc - return only selected fields', async (key) => {
    //insert a new doc
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    //read that back with projection
    const idToCheck = insertDocResp.insertedId;
    const findCursor = collection.find({ '_id': idToCheck, key }, {
      projection: {
        username: 1,
        'address.city': true,
      },
    });
    const resDoc = await findCursor.next();
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    assert.strictEqual(resDoc.username, doc.username);
    assert.strictEqual(resDoc.address?.city, doc.address?.city);
    assert.strictEqual(resDoc.address.number, undefined);
  });

  it('should find doc - return only selected fields (with exclusion)', async (key) => {
    //insert a new doc
    const doc = createSampleDocWithMultiLevel(key);
    const insertDocResp = await collection.insertOne(doc);
    //read that back with projection
    const idToCheck = insertDocResp.insertedId;
    const findCursor = collection.find({ '_id': idToCheck, key }, {
      projection: {
        username: 1,
        'address.city': true,
        _id: 0,
      },
    });
    const resDoc = await findCursor.next();
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, undefined);
    assert.strictEqual(resDoc.username, doc.username);
    assert.strictEqual(resDoc.address?.city, doc.address?.city);
    assert.strictEqual(resDoc.address.number, undefined);
  });

  it('should find doc - return only selected fields (array slice)', async (key) => {
    //insert some docs
    interface Doc {
      _id?: string;
      username: string;
      address: { city: string },
      tags?: string[]
    }

    const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', address: { city: 'nyc' }, key }));
    docList.forEach((doc, index) => {
      if (index == 5) {
        doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
      }
      if (index == 6) {
        doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'];
      }
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    //read that back with projection
    const findDocs = await collection.find({ key }, {
      projection: {
        username: 1,
        'address.city': true,
        _id: 0,
        tags: { '$slice': 1 },
      },
    }).toArray();
    assert.strictEqual(findDocs.length, 20);
    findDocs.forEach((resDoc) => {
      assert.ok(resDoc);
      assert.strictEqual(resDoc._id, undefined);
      assert.ok(resDoc.username);
      assert.ok(resDoc.address.city);
      assert.strictEqual(resDoc.address.number, undefined);
      if (resDoc.username == 'username6') {
        assert.strictEqual(resDoc.tags.length, 1);
        assert.strictEqual(resDoc.tags[0], 'tag1');
      } else if (resDoc.username == 'username7') {
        assert.strictEqual(resDoc.tags.length, 1);
        assert.strictEqual(resDoc.tags[0], 'tag1');
      }
    });
  });

  it('should find doc - return only selected fields (array slice negative)', async (key) => {
    //insert some docs
    interface Doc {
      _id?: string;
      username: string;
      address: { city: string },
      tags?: string[]
    }

    const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', address: { city: 'nyc' }, key }));
    docList.forEach((doc, index) => {
      if (index == 5) {
        doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
      }
      if (index == 6) {
        doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'];
      }
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    //read that back with projection
    const findDocs = await collection.find({ key }, {
      projection: {
        username: 1,
        'address.city': true,
        _id: 0,
        tags: { '$slice': -1 },
      },
    }).toArray();
    assert.strictEqual(findDocs.length, 20);
    findDocs.forEach((resDoc) => {
      assert.ok(resDoc);
      assert.strictEqual(resDoc._id, undefined);
      assert.ok(resDoc.username);
      assert.ok(resDoc.address.city);
      assert.strictEqual(resDoc.address.number, undefined);
      if (resDoc.username == 'username6') {
        assert.strictEqual(resDoc.tags.length, 1);
        assert.strictEqual(resDoc.tags[0], 'tag5');
      } else if (resDoc.username == 'username7') {
        assert.strictEqual(resDoc.tags.length, 1);
        assert.strictEqual(resDoc.tags[0], 'tag6');
      }
    });
  });

  it('should find doc - return only selected fields (array slice gt elements)', async (key) => {
    //insert some docs
    interface Doc {
      _id?: string;
      username: string;
      address: { city: string },
      tags?: string[]
    }

    const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', address: { city: 'nyc' }, key }));
    docList.forEach((doc, index) => {
      if (index == 5) {
        doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
      }
      if (index == 6) {
        doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'];
      }
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    //read that back with projection
    const findDocs = await collection.find({ key }, {
      projection: {
        username: 1,
        'address.city': true,
        _id: 0,
        tags: { '$slice': 6 },
      },
    }).toArray();
    assert.strictEqual(findDocs.length, 20);
    findDocs.forEach((resDoc) => {
      assert.ok(resDoc);
      assert.strictEqual(resDoc._id, undefined);
      assert.ok(resDoc.username);
      assert.ok(resDoc.address.city);
      assert.strictEqual(resDoc.address.number, undefined);
      if (resDoc.username == 'username6') {
        assert.strictEqual(resDoc.tags.length, 5);
      } else if (resDoc.username == 'username7') {
        assert.strictEqual(resDoc.tags.length, 6);
      }
    });
  });

  it('should find doc - return only selected fields (array slice gt elements negative)', async (key) => {
    //insert some docs
    interface Doc {
      _id?: string;
      username: string;
      address: { city: string },
      tags?: string[]
    }

    const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', address: { city: 'nyc' }, key }));
    docList.forEach((doc, index) => {
      doc.username = `${key}${index+1}`;
      if (index == 5) {
        doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
      }
      if (index == 6) {
        doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'];
      }
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    //read that back with projection
    const findDocs = await collection.find({ key }, {
      projection: {
        username: 1,
        'address.city': true,
        _id: 0,
        tags: { '$slice': -6 },
      },
    }).toArray();
    assert.strictEqual(findDocs.length, 20);
    findDocs.forEach((resDoc) => {
      assert.ok(resDoc);
      assert.strictEqual(resDoc._id, undefined);
      assert.ok(resDoc.username);
      assert.ok(resDoc.address.city);
      assert.strictEqual(resDoc.address.number, undefined);
      if (resDoc.username == `${key}6`) {
        assert.strictEqual(resDoc.tags.length, 5);
      } else if (resDoc.username == `${key}7`) {
        assert.strictEqual(resDoc.tags.length, 6);
      } else {
        assert.ok(!resDoc.tags);
      }
    });
  });

  it('should find & find doc $in test', async (key) => {
    interface Doc {
      _id?: string;
      username: string;
      city: string;
      tags?: string[];
    }

    const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc', key }));
    docList.forEach((doc, index) => {
      doc._id = `${key}` + index;
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    let idsArr = [`${key}1`, `${key}2`, `${key}3`];
    let ids: Set<string> = new Set(idsArr);
    let filter = { '_id': { '$in': idsArr }, key };
    const findRespDocs = await collection.find(filter).toArray();
    assert.strictEqual(findRespDocs.length, 3);
    //check if the doc ids of the returned docs are in the input list
    findRespDocs.forEach((doc) => {
      // noinspection SuspiciousTypeOfGuard
      assert.ok(typeof doc._id === 'string');
      assert.ok(doc._id.startsWith(key));
      assert.ok(doc._id.length > 2);
      assert.ok(ids.has(doc._id));
    });
    idsArr = [`${key}2`];
    ids = new Set(idsArr);
    filter = { '_id': { '$in': idsArr }, key };
    const findOneRespDoc = await collection.findOne(filter);
    assert.ok(findOneRespDoc?._id);
    assert.ok(ids.has(findOneRespDoc._id as string));
  });

  it('should find & find doc $nin test', async (key) => {
    interface Doc {
      _id?: string;
      username?: string;
      city: string;
      tags?: string[];
    }

    const docList_nyc: Doc[] = Array.from({ length: 3 }, () => ({ city: 'nyc', key }));
    docList_nyc.forEach((doc, index) => {
      doc.city = doc.city + String(index + 1);
    });
    const docList_seattle: Doc[] = Array.from({ length: 2 }, () => ({ city: 'seattle', key }));
    docList_seattle.forEach((doc, index) => {
      doc.city = doc.city + String(index + 1);
    });
    const res = await collection.insertMany(docList_nyc);
    assert.strictEqual(res.insertedCount, docList_nyc.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 3);
    const res1 = await collection.insertMany(docList_seattle);
    assert.strictEqual(res1.insertedCount, docList_seattle.length);
    assert.strictEqual(Object.keys(res1.insertedIds).length, 2);

    const cityArr = ['nyc1', 'nyc2', 'nyc3'];
    const filter = { 'city': { '$nin': cityArr }, key };
    const findRespDocs = await collection.find(filter).toArray();
    assert.strictEqual(findRespDocs.length, 2);
    //check if found docs city field starts with seattle
    findRespDocs.forEach((doc) => {
      assert.ok(doc.city.startsWith('seattle'));
    });
  });

  it('should find & find doc $exists true test', async (key) => {
    interface Doc {
      _id?: string;
      username: string;
      city: string;
      tags?: string[];
    }

    const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc', key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    const filter = { 'city': { '$exists': true }, key };
    const findRespDocs = await collection.find(filter).toArray();
    assert.strictEqual(findRespDocs.length, 20);
    //check if the doc ids of the returned docs are in the input list
    findRespDocs.forEach((doc) => {
      assert.ok(doc._id);
      assert.ok(doc.city);
    });
    const findOneRespDoc = await collection.findOne(filter);
    assert.ok(findOneRespDoc?._id);
    assert.ok(findOneRespDoc.city);
  });

  it('should find & find doc $exists false test', async (key) => {
    interface Doc {
      _id?: string;
      username: string;
      city?: string;
      tags?: string[];
    }

    const docList: Doc[] = Array.from({ length: 10 }, () => ({ username: 'withCity', city: 'nyc', key }));
    const docList_noCity: Doc[] = Array.from({ length: 10 }, () => ({ username: 'noCity', key }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 10);
    const res1 = await collection.insertMany(docList_noCity);
    assert.strictEqual(res1.insertedCount, docList_noCity.length);
    assert.strictEqual(Object.keys(res1.insertedIds).length, 10);
    const filter = { 'city': { '$exists': false }, key };
    const findRespDocs = await collection.find(filter).toArray();
    assert.strictEqual(findRespDocs.length, 10);
    //check city is not in return list
    findRespDocs.forEach((doc) => {
      assert.ok(doc._id);
      assert.ok(!doc.city);
    });
  });

  it('should find & find doc $all test', async (key) => {
    interface Doc {
      _id?: string;
      username: string;
      city: string;
      tags?: string[];
    }

    const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc', key }));
    docList.forEach((doc, index) => {
      doc._id = `id${index}`;
      if (index == 5) {
        doc.tags = ['tag1', 'tag2', 'tag3'];
      }
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    const filter = { 'tags': { '$all': ['tag1', 'tag2', 'tag3'] }, key };
    const findRespDocs = await collection.find(filter).toArray();
    assert.strictEqual(findRespDocs.length, 1);
    //check if the doc ids of the returned docs are in the input list
    findRespDocs.forEach((doc) => {
      assert.ok(doc._id);
      assert.ok(doc.city);
      assert.strictEqual(doc.tags.length, 3);
      assert.strictEqual(doc._id, docList[5]._id);
    });
    const findOneRespDoc = await collection.findOne(filter);
    assert.ok(findOneRespDoc?._id);
    assert.strictEqual(findOneRespDoc.tags?.length, 3);
    assert.strictEqual(findOneRespDoc._id, docList[5]._id);
  });

  it('should find & find doc $size test', async (key) => {
    interface Doc {
      _id?: string;
      username: string;
      city: string;
      tags?: string[];
    }

    const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc', key }));
    docList.forEach((doc, index) => {
      doc._id = `${key}${index}`;
      if (index == 4) {
        doc.tags = ['tag1', 'tag2', 'tag3', 'tag4'];
      }
      if (index == 5) {
        doc.tags = ['tag1', 'tag2', 'tag3'];
      }
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    const filter = { 'tags': { '$size': 3 }, key };
    const findRespDocs = await collection.find(filter).toArray();
    assert.strictEqual(findRespDocs.length, 1);
    //check if the doc ids of the returned docs are in the input list
    findRespDocs.forEach((doc) => {
      assert.ok(doc._id);
      assert.ok(doc.city);
      assert.strictEqual(doc.tags.length, 3);
      assert.strictEqual(doc._id, docList[5]._id);
    });
    const findOneRespDoc = await collection.findOne(filter);
    assert.ok(findOneRespDoc?._id);
    assert.strictEqual(findOneRespDoc.tags?.length, 3);
    assert.strictEqual(findOneRespDoc._id, docList[5]._id);
  });

  it('should find & find doc $size 0 test', async (key) => {
    interface Doc {
      _id?: string;
      username: string;
      city: string;
      tags?: string[];
    }

    const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc', key }));
    docList.forEach((doc, index) => {
      doc._id = key + index;
      if (index == 4) {
        doc.tags = ['tag1', 'tag2', 'tag3', 'tag4'];
      }
      if (index == 5) {
        doc.tags = ['tag1', 'tag2', 'tag3'];
      }
      if (index == 6) {
        doc.tags = [];
      }
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    const filter = { 'tags': { '$size': 0 }, key };
    const findRespDocs = await collection.find(filter).toArray();
    assert.strictEqual(findRespDocs.length, 1);
    //check if the doc ids of the returned docs are in the input list
    const idsToCheck: Set<string> = new Set([`${key}6`]);
    findRespDocs.forEach((doc) => {
      assert.ok(doc._id);
      assert.ok(doc.city);
      assert.strictEqual(doc.tags.length, 0);
      assert.ok(idsToCheck.has(doc._id as string));
    });
    const findOneRespDoc = await collection.findOne(filter);
    assert.ok(findOneRespDoc?._id);
    assert.ok(findOneRespDoc.tags?.length == 0);
    assert.ok(idsToCheck.has(findOneRespDoc._id as string));
  });
});
