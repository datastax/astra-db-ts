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

import assert from 'assert';
import { Db } from '@/src/collections/db';
import { Collection } from '@/src/collections/collection';
import { Client } from '@/src/collections/client';
import { testClient, testClientName, sampleUsersList, createSampleDocWithMultiLevel, createSampleDocWithMultiLevelWithId, TEST_COLLECTION_NAME } from '@/tests/fixtures';

describe(`StargateMongoose - ${testClientName} Connection - collections.collection`, async () => {
    const isAstra: boolean = testClientName === 'astra';
    let astraClient: Client | null;
    let db: Db;
    let collection: Collection;
    before(async function () {
        if (testClient == null) {
            return this.skip();
        }
        astraClient = await testClient?.client;
        if (astraClient === null) {
            return this.skip();
        }

        db = astraClient.db();
        await db.dropCollection(TEST_COLLECTION_NAME);
    });

    beforeEach(async function () {
        await db.createCollection(TEST_COLLECTION_NAME);
        collection = db.collection(TEST_COLLECTION_NAME);
    });

    afterEach(async function () {
        await db.dropCollection(TEST_COLLECTION_NAME);
    });

    describe('Collection initialization', () => {
        it('should initialize a Collection', () => {
            const collection = new Collection(db.httpClient, 'new_collection');
            assert.ok(collection);
        });
        it('should not initialize a Collection without a name', () => {
            let error: any;
            try {
                // @ts-ignore: Testing invalid input
                const collection = new Collection(db.httpClient);
                assert.ok(collection);
            } catch (e) {
                error = e;
            }
            assert.ok(error);
        });
    });

    describe('insertOne tests', () => {
        it('should insertOne document', async () => {
            const res = await collection.insertOne(createSampleDocWithMultiLevel());
            assert.ok(res);
            assert.strictEqual(res.acknowledged, true);
            assert.ok(res.insertedId);
        });
        it('should insertOne document with id', async () => {
            const docId = 'docml1';
            const docToInsert = createSampleDocWithMultiLevelWithId(docId);
            const res = await collection.insertOne(docToInsert);
            assert.ok(res);
            assert.strictEqual(res.acknowledged, true);
            assert.ok(res.insertedId, docId);
        });
        it('Should fail insert of doc over size 1 MB', async () => {
            const jsonDocGt1MB = new Array(1024 * 1024).fill('a').join('');
            const docToInsert = { username: jsonDocGt1MB };
            let error: any;
            try {
                await collection.insertOne(docToInsert);
            } catch (e: any) {
                error = e;
            }
            assert.ok(error);
            if(isAstra){
                //In Astra, it returns a 413 error prior to reaching the JSON API
                assert.strictEqual(error.errors[0].message, 'Request failed with status code 413');
            } else {
                assert.strictEqual(error.errors[0].message, 'Document size limitation violated: document size (1048636 chars) exceeds maximum allowed (1000000)');
            }
        });
        it('Should fail if the number of levels in the doc is > 8', async () => {
            const docToInsert = { l1: { l2: { l3: { l4: { l5: { l6: { l7: { l8: { l9: 'l9value' } } } } } } } } };
            let error: any;
            try {
                await collection.insertOne(docToInsert);
            } catch (e: any) {
                error = e;
            }
            assert.ok(error);
            assert.strictEqual(error.errors[0].message, 'Document size limitation violated: document depth exceeds maximum allowed (8)');
        });
        it('Should fail if the field length is > 48', async () => {
            const fieldName = 'a'.repeat(49);
            const docToInsert = { [fieldName]: 'value' };
            let error: any;
            try {
                await collection.insertOne(docToInsert);
            } catch (e: any) {
                error = e;
            }
            assert.ok(error);
            assert.strictEqual(error.errors[0].message, 'Document size limitation violated: Property name length (49) exceeds maximum allowed (48)');
        });
        it('Should fail if the string field value is > 16000', async () => {
            const _string16klength = new Array(16001).fill('a').join('');
            const docToInsert = { username: _string16klength };
            let error: any;
            try {
                await collection.insertOne(docToInsert);
            } catch (e: any) {
                error = e;
            }
            assert.ok(error);
            assert.strictEqual(error.errors[0].message, 'Document size limitation violated: String value length (16001) exceeds maximum allowed (16000)');
        });
        it('Should fail if an array field size is > 100', async () => {
            const docToInsert = { tags: new Array(101).fill('tag') };
            let error: any;
            try {
                await collection.insertOne(docToInsert);
            } catch (e: any) {
                error = e;
            }
            assert.ok(error);
            assert.strictEqual(error.errors[0].message, 'Document size limitation violated: number of elements an Array has (101) exceeds maximum allowed (100)');
        });
        it('Should fail if a doc contains more than 64 properties', async () => {
            const docToInsert: any = { _id: '123' };
            for (let i = 1; i <= 64; i++) {
                docToInsert[`prop${i}`] = `prop${i}value`;
            }
            let error: any;
            try {
                await collection.insertOne(docToInsert);
            } catch (e: any) {
                error = e;
            }
            assert.ok(error);
            assert.strictEqual(error.errors[0].message, 'Document size limitation violated: number of properties an Object has (65) exceeds maximum allowed (64)');
        });
    });
    describe('insertMany tests', () => {
        it('should insertMany documents', async () => {
            const res = await collection.insertMany(sampleUsersList);
            assert.strictEqual(res.insertedCount, sampleUsersList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, 3);
        });
        it('should insertMany documents with ids', async () => {
            const sampleDocsWithIdList = JSON.parse(JSON.stringify(sampleUsersList));
            sampleDocsWithIdList[0]._id = 'docml1';
            sampleDocsWithIdList[1]._id = 'docml2';
            sampleDocsWithIdList[2]._id = 'docml3';
            const res = await collection.insertMany(sampleDocsWithIdList);
            assert.strictEqual(res.insertedCount, sampleDocsWithIdList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, 3);
        });
        it('should not insert more than allowed number of documents in one insertMany call', async () => {
            const docList = Array.from({ length: 21 }, () => ({ 'username': 'id' }));
            docList.forEach((doc, index) => {
                doc.username = doc.username + (index + 1);
            });
            let error: any;
            try {
                await collection.insertMany(docList);
            } catch (e: any) {
                error = e;
            }
            assert.ok(error);
            assert.strictEqual(error.errors[0].message, 'Request invalid, the field postCommand.command.documents not valid: amount of documents to insert is over the max limit (21 vs 20).');
        });
        it('should error out when docs list is empty in insertMany', async () => {
            let error: any;
            try {
                await collection.insertMany([]);
            } catch (e: any) {
                error = e;
            }
            assert.strictEqual(error.errors[0].message, 'Request invalid, the field postCommand.command.documents not valid: must not be empty.');
        });
        it('should insertMany documents ordered', async () => {
            const docList:{ _id?: string, username:string }[]  = Array.from({ length: 20 }, () => ({ 'username': 'id' }));
            docList.forEach((doc, index) => {
                doc._id = 'docml' + (index + 1);
                doc.username = doc.username + (index + 1);
            });
            const res = await collection.insertMany(docList, { ordered: true });
            assert.strictEqual(res.insertedCount, docList.length);
            //check if response insertedIds are in the order of the docs list
            docList.forEach((doc, index) => {
                assert.strictEqual(res.insertedIds[index], doc._id);
            });
        });
        it('should error out when one of the docs in insertMany is invalid with ordered true', async () => {
            const docList:{ _id?: string, username:string }[] = Array.from({ length: 20 }, () => ({ 'username': 'id' }));
            docList.forEach((doc, index) => {
                doc._id = 'docml' + (index + 1);
                doc.username = doc.username + (index + 1);
            });
            docList[10] = docList[9];
            let error: any;
            try {
                await collection.insertMany(docList, { ordered: true });
            } catch (e: any) {
                error = e;
            }
            assert.ok(error);
            assert.strictEqual(error.errors[0].message, 'Failed to insert document with _id \'docml10\': Document already exists with the given _id');
            assert.strictEqual(error.errors[0].errorCode, 'DOCUMENT_ALREADY_EXISTS');
            assert.strictEqual(error.status.insertedIds.length, 10);
            docList.slice(0, 10).forEach((doc, index) => {
                assert.strictEqual(error.status.insertedIds[index], doc._id);
            });
        });
        it('should error out when one of the docs in insertMany is invalid with ordered false', async () => {
            const docList:{ _id?: string, username:string }[] = Array.from({ length: 20 }, () => ({ 'username': 'id' }));
            docList.forEach((doc, index) => {
                doc._id = 'docml' + (index + 1);
                doc.username = doc.username + (index + 1);
            });
            docList[10] = docList[9];
            let error: any;
            try {
                await collection.insertMany(docList, { ordered: false });
            } catch (e: any) {
                error = e;
            }
            assert.ok(error);
            assert.strictEqual(error.errors[0].message, 'Failed to insert document with _id \'docml10\': Document already exists with the given _id');
            assert.strictEqual(error.errors[0].errorCode, 'DOCUMENT_ALREADY_EXISTS');
            assert.strictEqual(error.status.insertedIds.length, 19);
            //check if response insertedIds contains all the docs except the one that failed
            docList.slice(0, 9).concat(docList.slice(10)).forEach((doc) => {
                //check if error.status.insertedIds contains doc._id
                assert.ok(error.status.insertedIds.includes(doc._id));
            });
        });
    });
    describe('findOne, findMany & filter tests', () => {
        it('should find & findOne document', async () => {
            const insertDocResp = await collection.insertOne(createSampleDocWithMultiLevel());
            const idToCheck = insertDocResp.insertedId;
            const filter = { '_id': idToCheck };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne eq document', async () => {
            const insertDocResp = await collection.insertOne(createSampleDocWithMultiLevel());
            const idToCheck = insertDocResp.insertedId;
            const filter = { '_id': { '$eq': idToCheck } };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne L1 String EQ document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'username': doc.username };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne L1 String EQ $eq document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'username': { '$eq': doc.username } };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne L1 Number EQ document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'age': doc.age };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne L1 Number EQ $eq document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'age': { '$eq': doc.age } };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne L1 Boolean EQ document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'human': doc.human };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne L1 Boolean EQ $eq document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'human': { '$eq': doc.human } };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne L1 Null EQ document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'password': doc.password };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne L1 Null EQ $eq document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'password': { '$eq': doc.password } };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne any level String EQ document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'address.street': doc.address?.street };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne any level String EQ $eq document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'address.street': { '$eq': doc.address?.street } };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne any level Number EQ document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'address.number': doc.address?.number };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should findOne any level Number EQ $eq document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'address.number': { '$eq': doc.address?.number } };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne any level Boolean EQ document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'address.is_office': doc.address?.is_office };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne any level Boolean EQ $eq document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'address.is_office': { '$eq': doc.address?.is_office } };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne any level Null EQ document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'address.suburb': doc.address?.suburb };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne any level Null EQ $eq document', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'address.suburb': { '$eq': doc.address?.suburb } };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne multiple top level conditions', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { age: doc.age, human: doc.human, password: doc.password };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne multiple level>=2 conditions', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'address.number': doc.address?.number, 'address.street': doc.address?.street, 'address.is_office': doc.address?.is_office };
            const resDoc = await collection.findOne(filter);
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find & findOne multiple mixed levels conditions', async () => {
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            const idToCheck = insertDocResp.insertedId;
            const filter = { 'age': doc.age, 'address.street': doc.address?.street, 'address.is_office': doc.address?.is_office };
            const findOneResDoc = await collection.findOne(filter);
            assert.ok(findOneResDoc);
            assert.strictEqual(findOneResDoc._id, idToCheck);
            const findResDocs = await collection.find(filter).toArray();
            assert.strictEqual(findResDocs.length, 1);
            assert.strictEqual(findResDocs[0]._id, idToCheck);
        });
        it('should find doc - return only selected fields', async () => {
            //insert a new doc
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            //read that back with projection
            const idToCheck = insertDocResp.insertedId;
            const findCursor = await collection.find({ '_id': idToCheck }, { projection: { username: 1, 'address.city': true } });
            const resDoc = await findCursor.next();
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, idToCheck);
            assert.strictEqual(resDoc.username, doc.username);
            assert.strictEqual(resDoc.address.city, doc.address?.city);
            assert.strictEqual(resDoc.address.number, undefined);
        });
        it('should find doc - return only selected fields (with exclusion)', async () => {
            //insert a new doc
            const doc = createSampleDocWithMultiLevel();
            const insertDocResp = await collection.insertOne(doc);
            //read that back with projection
            const idToCheck = insertDocResp.insertedId;
            const findCursor = await collection.find({ '_id': idToCheck }, { projection: { username: 1, 'address.city': true, _id: 0 } });
            const resDoc = await findCursor.next();
            assert.ok(resDoc);
            assert.strictEqual(resDoc._id, undefined);
            assert.strictEqual(resDoc.username, doc.username);
            assert.strictEqual(resDoc.address.city, doc.address?.city);
            assert.strictEqual(resDoc.address.number, undefined);
        });
        it('should find doc - return only selected fields (array slice)', async () => {
      //insert some docs
      interface Doc {
        _id?: string;
        username: string;
        address: { city: string },
        tags?: string[]
      }
      const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', address: { city: 'nyc' } }));
      docList.forEach((doc, index) => {
          doc._id = 'id' + index;
          doc.username = doc.username + (index + 1);
          if (index == 5) {
              doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
          }
          if (index == 6) {
              doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'];
          }
      });
      const res = await collection.insertMany(docList);
      assert.strictEqual(res.insertedCount, docList.length);
      assert.strictEqual(res.acknowledged, true);
      assert.strictEqual(Object.keys(res.insertedIds).length, 20);
      //read that back with projection      
      const findDocs = await collection.find({}, { projection: { username: 1, 'address.city': true, _id: 0, tags: { '$slice': 1 } } }).toArray();
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
        it('should find doc - return only selected fields (array slice negative)', async () => {
      //insert some docs
      interface Doc {
        _id?: string;
        username: string;
        address: { city: string },
        tags?: string[]
      }
      const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', address: { city: 'nyc' } }));
      docList.forEach((doc, index) => {
          doc._id = 'id' + index;
          doc.username = doc.username + (index + 1);
          if (index == 5) {
              doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
          }
          if (index == 6) {
              doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'];
          }
      });
      const res = await collection.insertMany(docList);
      assert.strictEqual(res.insertedCount, docList.length);
      assert.strictEqual(res.acknowledged, true);
      assert.strictEqual(Object.keys(res.insertedIds).length, 20);
      //read that back with projection      
      const findDocs = await collection.find({}, { projection: { username: 1, 'address.city': true, _id: 0, tags: { '$slice': -1 } } }).toArray();
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
        it('should find doc - return only selected fields (array slice gt elements)', async () => {
      //insert some docs
      interface Doc {
        _id?: string;
        username: string;
        address: { city: string },
        tags?: string[]
      }
      const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', address: { city: 'nyc' } }));
      docList.forEach((doc, index) => {
          doc._id = 'id' + index;
          doc.username = doc.username + (index + 1);
          if (index == 5) {
              doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
          }
          if (index == 6) {
              doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'];
          }
      });
      const res = await collection.insertMany(docList);
      assert.strictEqual(res.insertedCount, docList.length);
      assert.strictEqual(res.acknowledged, true);
      assert.strictEqual(Object.keys(res.insertedIds).length, 20);
      //read that back with projection      
      const findDocs = await collection.find({}, { projection: { username: 1, 'address.city': true, _id: 0, tags: { '$slice': 6 } } }).toArray();
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
        it('should find doc - return only selected fields (array slice gt elements negative)', async () => {
      //insert some docs
      interface Doc {
        _id?: string;
        username: string;
        address: { city: string },
        tags?: string[]
      }
      const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', address: { city: 'nyc' } }));
      docList.forEach((doc, index) => {
          doc._id = 'id' + index;
          doc.username = doc.username + (index + 1);
          if (index == 5) {
              doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
          }
          if (index == 6) {
              doc.tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'];
          }
      });
      const res = await collection.insertMany(docList);
      assert.strictEqual(res.insertedCount, docList.length);
      assert.strictEqual(res.acknowledged, true);
      assert.strictEqual(Object.keys(res.insertedIds).length, 20);
      //read that back with projection      
      const findDocs = await collection.find({}, { projection: { username: 1, 'address.city': true, _id: 0, tags: { '$slice': -6 } } }).toArray();
      assert.strictEqual(findDocs.length, 20);
      findDocs.forEach((resDoc) => {
          assert.ok(resDoc);
          assert.strictEqual(resDoc._id, undefined);
          assert.ok(resDoc.username);
          assert.ok(resDoc.address.city);
          assert.strictEqual(resDoc.address.number, undefined);
          if (resDoc.username == 'id6') {
              assert.strictEqual(resDoc.tags.length, 5);
          } else if (resDoc.username == 'id7') {
              assert.strictEqual(resDoc.tags.length, 6);
          } else {
              assert.ok(!resDoc.tags);
          }
      });
        });
        it('should find & find doc $in test', async () => {
      interface Doc { _id?: string; username: string; city: string; tags?: string[] }
      const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
      docList.forEach((doc, index) => {
          doc._id = 'id' + index;
          doc.username = doc.username + (index + 1);
      });
      const res = await collection.insertMany(docList);
      assert.strictEqual(res.insertedCount, docList.length);
      assert.strictEqual(res.acknowledged, true);
      assert.strictEqual(Object.keys(res.insertedIds).length, 20);
      let idsArr = ['id1', 'id2', 'id3'];
      let ids: Set<string> = new Set(idsArr);
      let filter = { '_id': { '$in': idsArr } };
      const findRespDocs = await collection.find(filter).toArray();
      assert.strictEqual(findRespDocs.length, 3);
      //check if the doc ids of the returned docs are in the input list
      findRespDocs.forEach((doc) => {
          assert.ok(doc._id);
          assert.ok(doc._id.startsWith('id'));
          assert.ok(doc._id.length > 2);
          assert.ok(ids.has(doc._id));
      });
      idsArr = ['id2'];
      ids = new Set(idsArr);
      filter = { '_id': { '$in': idsArr } };
      const findOneRespDoc = await collection.findOne(filter);
      assert.ok(findOneRespDoc!._id);
      assert.ok(ids.has(findOneRespDoc!._id));
        });
        it('should find & find doc $exists test', async () => {
      interface Doc { _id?: string; username: string; city: string; tags?: string[] }
      const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
      docList.forEach((doc, index) => {
          doc._id = 'id' + index;
          doc.username = doc.username + (index + 1);
      });
      const res = await collection.insertMany(docList);
      assert.strictEqual(res.insertedCount, docList.length);
      assert.strictEqual(res.acknowledged, true);
      assert.strictEqual(Object.keys(res.insertedIds).length, 20);
      const filter = { 'city': { '$exists': true } };
      const findRespDocs = await collection.find(filter).toArray();
      assert.strictEqual(findRespDocs.length, 20);
      //check if the doc ids of the returned docs are in the input list
      findRespDocs.forEach((doc) => {
          assert.ok(doc._id);
          assert.ok(doc.city);
      });
      const findOneRespDoc = await collection.findOne(filter);
      assert.ok(findOneRespDoc!._id);
      assert.ok(findOneRespDoc!.city);
        });
        it('should find & find doc $all test', async () => {
      interface Doc { _id?: string; username: string; city: string; tags?: string[] }
      const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
      docList.forEach((doc, index) => {
          doc._id = 'id' + index;
          doc.username = doc.username + (index + 1);
          if (index == 5) {
              doc.tags = ['tag1', 'tag2', 'tag3'];
          }
      });
      const res = await collection.insertMany(docList);
      assert.strictEqual(res.insertedCount, docList.length);
      assert.strictEqual(res.acknowledged, true);
      assert.strictEqual(Object.keys(res.insertedIds).length, 20);
      const filter = { 'tags': { '$all': ['tag1', 'tag2', 'tag3'] } };
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
      assert.ok(findOneRespDoc!._id);
      assert.strictEqual(findOneRespDoc!.tags.length, 3);
      assert.strictEqual(findOneRespDoc!._id, docList[5]._id);
        });
        it('should find & find doc $size test', async () => {
      interface Doc { _id?: string; username: string; city: string; tags?: string[] }
      const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
      docList.forEach((doc, index) => {
          doc._id = 'id' + index;
          doc.username = doc.username + (index + 1);
          if (index == 4) {
              doc.tags = ['tag1', 'tag2', 'tag3', 'tag4'];
          }
          if (index == 5) {
              doc.tags = ['tag1', 'tag2', 'tag3'];
          }
      });
      const res = await collection.insertMany(docList);
      assert.strictEqual(res.insertedCount, docList.length);
      assert.strictEqual(res.acknowledged, true);
      assert.strictEqual(Object.keys(res.insertedIds).length, 20);
      const filter = { 'tags': { '$size': 3 } };
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
      assert.ok(findOneRespDoc!._id);
      assert.strictEqual(findOneRespDoc!.tags.length, 3);
      assert.strictEqual(findOneRespDoc!._id, docList[5]._id);
        });
        it('should find & find doc $size 0 test', async () => {
      interface Doc { _id?: string; username: string; city: string; tags?: string[] }
      const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
      docList.forEach((doc, index) => {
          doc._id = 'id' + index;
          doc.username = doc.username + (index + 1);
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
      assert.strictEqual(res.acknowledged, true);
      assert.strictEqual(Object.keys(res.insertedIds).length, 20);
      const filter = { 'tags': { '$size': 0 } };
      const findRespDocs = await collection.find(filter).toArray();
      assert.strictEqual(findRespDocs.length, 1);
      //check if the doc ids of the returned docs are in the input list
      const idsToCheck: Set<string> = new Set(['id6']);
      findRespDocs.forEach((doc) => {
          assert.ok(doc._id);
          assert.ok(doc.city);
          assert.strictEqual(doc.tags.length, 0);
          assert.ok(idsToCheck.has(doc._id));
      });
      const findOneRespDoc = await collection.findOne(filter);
      assert.ok(findOneRespDoc!._id);
      assert.ok(findOneRespDoc!.tags.length == 0);
      assert.ok(idsToCheck.has(findOneRespDoc!._id));
        });
    });
    describe('updateOne tests', () => {
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
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            const updatedDoc = await collection.findOne({ 'username': 'aaronm' });
            assert.strictEqual(updatedDoc!._id, idToCheck);
            assert.strictEqual(updatedDoc!.username, 'aaronm');
            assert.strictEqual(updatedDoc!.address.city, undefined);
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
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            const updatedDoc = await collection.findOne({ 'username': 'aaron' });
            assert.strictEqual(updatedDoc!._id, idToCheck);
            assert.strictEqual(updatedDoc!.username, 'aaron');
            assert.strictEqual(updatedDoc!.address.city, 'big banana');
            assert.strictEqual(updatedDoc!.address.state, 'new state');
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
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.ok(updateOneResp.upsertedId);
            assert.strictEqual(updateOneResp.upsertedCount, 1);
            const updatedDoc = await collection.findOne({ 'address.city': 'nyc' });
            assert.ok(updatedDoc!._id);
            assert.notStrictEqual(updatedDoc!._id, idToCheck);
            assert.strictEqual(updatedDoc!.address.city, 'nyc');
            assert.strictEqual(updatedDoc!.address.state, 'ny');
        });
        it('should make _id an ObjectId when upserting with no _id', async () => {
            await collection.deleteMany({});
            const updateOneResp = await collection.updateOne(
                {},
                {
                    '$set': {
                        'username': 'aaronm'
                    }
                },
                {
                    'upsert': true
                }
            );
            assert.ok(updateOneResp.upsertedId.match(/^[a-f\d]{24}$/i), updateOneResp.upsertedId);
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
    describe('updateMany tests', () => {
        it('should updateMany documents with ids', async () => {
            const sampleDocsWithIdList = JSON.parse(JSON.stringify(sampleUsersList));
            sampleDocsWithIdList[0]._id = 'docml1';
            sampleDocsWithIdList[1]._id = 'docml2';
            sampleDocsWithIdList[2]._id = 'docml3';
            const res = await collection.insertMany(sampleDocsWithIdList);
            assert.strictEqual(res.insertedCount, sampleDocsWithIdList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, 3);
            const idToUpdateAndCheck = sampleDocsWithIdList[0]._id;
            const updateManyResp = await collection.updateMany({ '_id': idToUpdateAndCheck },
                {
                    '$set': { 'username': 'aaronm' },
                    '$unset': { 'address.city': '' }
                });
            assert.strictEqual(updateManyResp.matchedCount, 1);
            assert.strictEqual(updateManyResp.modifiedCount, 1);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ 'username': 'aaronm' });
            assert.strictEqual(updatedDoc!._id, idToUpdateAndCheck);
            assert.strictEqual(updatedDoc!.username, 'aaronm');
            assert.strictEqual(updatedDoc!.address.city, undefined);
        });
        it('should update when updateMany is invoked with updates for records <= 20', async () => {
            const docList = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
            docList.forEach((doc, index) => {
                doc.username = doc.username + (index + 1);
            });
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, 20);

            //const idToUpdateAndCheck = sampleDocsWithIdList[0]._id;
            const updateManyResp = await collection.updateMany({ 'city': 'nyc' },
                {
                    '$set': { 'state': 'ny' }
                });
            assert.strictEqual(updateManyResp.matchedCount, 20);
            assert.strictEqual(updateManyResp.modifiedCount, 20);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
        });
        it('should upsert with upsert flag set to false/not set when not found', async () => {
            const docList = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
            docList.forEach((doc, index) => {
                doc.username = doc.username + (index + 1);
            });
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, 20);

            //const idToUpdateAndCheck = sampleDocsWithIdList[0]._id;
            const updateManyResp = await collection.updateMany({ 'city': 'la' },
                {
                    '$set': { 'state': 'ca' }
                });
            assert.strictEqual(updateManyResp.matchedCount, 0);
            assert.strictEqual(updateManyResp.modifiedCount, 0);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
        });
        it('should upsert with upsert flag set to true when not found', async () => {
            const docList = Array.from({ length: 2 }, () => ({ username: 'id', city: 'nyc' }));
            docList.forEach((doc, index) => {
                doc.username = doc.username + (index + 1);
            });
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, 2);

            //const idToUpdateAndCheck = sampleDocsWithIdList[0]._id;
            const updateManyResp = await collection.updateMany({ 'city': 'la' },
                {
                    '$set': { 'state': 'ca' }
                },
                {
                    'upsert': true
                });
            assert.strictEqual(updateManyResp.matchedCount, 0);
            assert.strictEqual(updateManyResp.modifiedCount, 0);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, 1);
            assert.ok(updateManyResp.upsertedId);
        });
        it('should fail when moreData returned by updateMany as true', async () => {
            const docList = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
            docList.forEach((doc, index) => {
                doc.username = doc.username + (index + 1);
            });
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //insert next 20
            const docListNextSet = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
            docListNextSet.forEach((doc, index) => {
                doc.username = doc.username + (index + 21);
            });
            const resNextSet = await collection.insertMany(docListNextSet);
            assert.strictEqual(resNextSet.insertedCount, docListNextSet.length);
            assert.strictEqual(resNextSet.acknowledged, true);
            assert.strictEqual(Object.keys(resNextSet.insertedIds).length, docListNextSet.length);


            //const idToUpdateAndCheck = sampleDocsWithIdList[0]._id;
            const filter = { 'city': 'nyc' };
            const update = {
                '$set': { 'state': 'ny' }
            };
            let error;
            try {
                await collection.updateMany(filter, update);
            }
            catch (e: any) {
                error = e;
            }
            assert.ok(error);
            assert.strictEqual(error.message, 'Command "updateMany" failed with the following error: More than 20 records found for update by the server');
            assert.deepStrictEqual(error.command.updateMany.filter, filter);
            assert.deepStrictEqual(error.command.updateMany.update, update);
        });
        it('should increment number when $inc is used', async () => {
            const docList = Array.from({ length: 20 }, () => ({ _id : 'id', username: 'username', city: 'trichy', count: 0 }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.username = doc.username + index;        
                doc.count = index === 5 ? 5 : (index === 8 ? 8 : index);
            });
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update count of 5th doc by $inc using updateOne API
            const updateOneResp = await collection.updateOne({ '_id': 'id5' }, { '$inc': { 'count': 1 } });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id5' });
            assert.strictEqual(updatedDoc!.count, 6);
            //update count of 5th doc by $inc using updateMany API
            const updateManyResp = await collection.updateMany({}, { '$inc': { 'count': 1 } });
            assert.strictEqual(updateManyResp.matchedCount, 20);
            assert.strictEqual(updateManyResp.modifiedCount,  20);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const allDocs = await collection.find({}).toArray();
            assert.strictEqual(allDocs.length, 20);
            allDocs.forEach((doc) => {
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
            const docList = Array.from({ length: 20 }, () => ({ _id : 'id', username: 'username', city: 'trichy', count: 0.0 }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.username = doc.username + index;        
                doc.count = index === 5 ? 5.5 : (index === 8 ? 8.5 : index + 0.5);
            });
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update count of 5th doc by $inc using updateOne API
            const updateOneResp = await collection.updateOne({ '_id': 'id5' }, { '$inc': { 'count': 1 } });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id5' });
            assert.strictEqual(updatedDoc!.count, 6.5);
            //update count of 5th doc by $inc using updateMany API
            const updateManyResp = await collection.updateMany({}, { '$inc': { 'count': 1 } });
            assert.strictEqual(updateManyResp.matchedCount, 20);
            assert.strictEqual(updateManyResp.modifiedCount,  20);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const allDocs = await collection.find({}).toArray();
            assert.strictEqual(allDocs.length, 20);
            allDocs.forEach((doc) => {
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
            const docList = Array.from({ length: 20 }, () => ({ _id : 'id', username: 'username', city: 'trichy', zip: 620020 }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.username = doc.username + index;        
            });
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update the doc by changing the zip field to pincode in the 5th doc using updateOne API
            const updateOneResp = await collection.updateOne({ '_id': 'id5' }, { '$rename': { 'zip': 'pincode' } });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id5' });
            assert.strictEqual(updatedDoc!.pincode, 620020);
            assert.strictEqual(updatedDoc!.zip, undefined);
            //update the doc by changing the zip field to pincode in all docs using updateMany API
            const updateManyResp = await collection.updateMany({}, { '$rename': { 'zip': 'pincode' } });
            assert.strictEqual(updateManyResp.matchedCount, 20);
            assert.strictEqual(updateManyResp.modifiedCount, 19);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const allDocs = await collection.find({}).toArray();
            assert.strictEqual(allDocs.length, 20);
            allDocs.forEach((doc) => {
                assert.strictEqual(doc.pincode, 620020);
                assert.strictEqual(doc.zip, undefined);
            });
        });
        it('should rename a sub doc field when $rename is used in update and updateMany', async () => {
            const docList = Array.from({ length: 20 }, () => ({ _id : 'id', username: 'username', address: { zip: 620020, city: 'trichy' } }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.username = doc.username + index;        
            });
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update the doc by changing the zip field to pincode in the 5th doc using updateOne API
            const updateOneResp = await collection.updateOne({ '_id': 'id5' }, { '$rename': { 'address.zip': 'address.pincode' } });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id5' });
            assert.strictEqual(updatedDoc!.address.pincode, 620020);
            assert.strictEqual(updatedDoc!.address.zip, undefined);
            //update the doc by changing the zip field to pincode in all docs using updateMany API
            const updateManyResp = await collection.updateMany({}, { '$rename': { 'address.zip': 'address.pincode' } });
            assert.strictEqual(updateManyResp.matchedCount, 20);
            assert.strictEqual(updateManyResp.modifiedCount, 19);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const allDocs = await collection.find({}).toArray();
            assert.strictEqual(allDocs.length, 20);
            allDocs.forEach((doc) => {
                assert.strictEqual(doc.address.pincode, 620020);
                assert.strictEqual(doc.address.zip, undefined);
            });
        });
        it('should set date to current date in the fields inside $currentDate in update and updateMany', async () => {
            const docList = Array.from({ length: 20 }, () => ({ _id : 'id', username: 'username' }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.username = doc.username + index;        
            });
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update the doc by setting the date field to current date in the 5th doc using updateOne API
            const updateOneResp = await collection.updateOne({ '_id': 'id5' }, { '$currentDate': { 'createdAt': true } });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id5' });
            assert.ok(updatedDoc!.createdAt);
            //update the doc by setting the date field to current date in all docs using updateMany API
            const updateManyResp = await collection.updateMany({}, { '$currentDate': { 'createdAt': true } });
            assert.strictEqual(updateManyResp.matchedCount, 20);
            assert.strictEqual(updateManyResp.modifiedCount, 20);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const allDocs = await collection.find({}).toArray();
            assert.strictEqual(allDocs.length, 20);
            allDocs.forEach((doc) => {
                assert.ok(doc.createdAt);
            });
        });
        it('should set fields under $setOnInsert when upsert is true in updateOne', async () => {
            const docList = Array.from({ length: 20 }, () => ({ _id : 'id', username: 'username', city: 'trichy' }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.username = doc.username + index;        
            });
            //insert all docs
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update the 5th doc using updateOne API with upsert true and $setOnInsert field with a new field and value
            const updateOneResp = await collection.updateOne({ '_id': 'id5' }, { '$set': { 'country': 'India' }, '$setOnInsert': { 'pincode': 620020 } }, { 'upsert': true });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id5' });
            //assert that the pincode field is not set in the 5th doc because the fields under $setOnInsert are set only when the doc is inserted
            assert.strictEqual(updatedDoc!.pincode, undefined);
            assert.strictEqual(updatedDoc!.country, 'India');
            //update doc with invalid id using updateOne API with upsert true and $setOnInsert field with a new field and value
            const updateOneResp1 = await collection.updateOne({ '_id': 'id21' }, { '$set': { 'country': 'India' }, '$setOnInsert': { 'pincode': 620020 } }, { 'upsert': true });
            assert.strictEqual(updateOneResp1.matchedCount, 0);
            assert.strictEqual(updateOneResp1.modifiedCount, 0);
            assert.strictEqual(updateOneResp1.acknowledged, true);
            assert.strictEqual(updateOneResp1.upsertedCount, 1);
            assert.strictEqual(updateOneResp1.upsertedId, 'id21');
            const updatedDoc1 = await collection.findOne({ '_id': 'id21' });
            //assert that the pincode field is set in the 21st doc because the fields under $setOnInsert are set only when the doc is inserted
            assert.strictEqual(updatedDoc1!.pincode, 620020);
            assert.strictEqual(updatedDoc1!.country, 'India');
        });
        it('should set fields under $setOnInsert when upsert is true in updateMany', async () => {
            const docList = Array.from({ length: 20 }, () => ({ _id : 'id', username: 'username', city: 'trichy' }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.username = doc.username + index;        
            });
            //insert all docs
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update the 5th doc using updateMany API with upsert true and $setOnInsert field with a new field and value
            const updateManyResp = await collection.updateMany({ '_id': 'id5' }, { '$set': { 'country': 'India' }, '$setOnInsert': { 'pincode': 620020 } }, { 'upsert': true });
            assert.strictEqual(updateManyResp.matchedCount, 1);
            assert.strictEqual(updateManyResp.modifiedCount, 1);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id5' });
            //assert that the pincode field is not set in the 5th doc because the fields under $setOnInsert are set only when the doc is inserted
            assert.strictEqual(updatedDoc!.pincode, undefined);
            assert.strictEqual(updatedDoc!.country, 'India');
            //update doc with invalid id using updateMany API with upsert true and $setOnInsert field with a new field and value
            const updateManyResp1 = await collection.updateMany({ '_id': 'id21' }, { '$set': { 'country': 'India' }, '$setOnInsert': { 'pincode': 620020 } }, { 'upsert': true });
            assert.strictEqual(updateManyResp1.matchedCount, 0);
            assert.strictEqual(updateManyResp1.modifiedCount, 0);
            assert.strictEqual(updateManyResp1.acknowledged, true);
            assert.strictEqual(updateManyResp1.upsertedCount, 1);
            assert.strictEqual(updateManyResp1.upsertedId, 'id21');
            const updatedDoc1 = await collection.findOne({ '_id': 'id21' });
            //assert that the pincode field is set in the 21st doc because the fields under $setOnInsert are set only when the doc is inserted
            assert.strictEqual(updatedDoc1!.pincode, 620020);      
            assert.strictEqual(updatedDoc1!.country, 'India');
        });
        it('should set a field value to new value when the new value is < existing value with $min in updateOne and updateMany', async () => {
            const docList = Array.from({ length: 20 }, () => ({ _id : 'id', departmentName: 'dept', minScore: 50, maxScore: 800 }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.departmentName = doc.departmentName + index;        
                if(index == 4){
                    doc.minScore = 10;
                }
            });
            //insert all docs
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update the 4th doc using updateOne API with $min operator to set the minScore to 5
            const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$min': { 'minScore': 5 } });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id4' });
            //assert that the minScore field is set to 5 in the 4th doc because the $min operator sets the field value to new value when the new value is less than existing value
            assert.strictEqual(updatedDoc!.minScore, 5);
            //update the 4th doc using updateOne API with $min operator to set the minScore to 15
            const updateOneResp1 = await collection.updateOne({ '_id': 'id4' }, { '$min': { 'minScore': 15 } });
            assert.strictEqual(updateOneResp1.matchedCount, 1);
            assert.strictEqual(updateOneResp1.modifiedCount, 0);
            assert.strictEqual(updateOneResp1.acknowledged, true);
            assert.strictEqual(updateOneResp1.upsertedCount, undefined);
            assert.strictEqual(updateOneResp1.upsertedId, undefined);
            const updatedDoc1 = await collection.findOne({ '_id': 'id4' });
            //assert that the minScore field is not set to 15 in the 5th doc because the $min operator does not set the field value to new value when the new value is greater than existing value
            assert.strictEqual(updatedDoc1!.minScore, 5);    
            //update all docs using updateMany API with $min operator to set the minScore to 15
            const updateManyResp = await collection.updateMany({ }, { '$min': { 'minScore': 15 } });
            assert.strictEqual(updateManyResp.matchedCount, 20);
            assert.strictEqual(updateManyResp.modifiedCount, 19);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const allDocs = await collection.find({ }).toArray();
            //assert that the minScore field is set to 15 in all docs because the $min operator sets the field value to new value when the new value is less than existing value
            allDocs.forEach(doc => {
                if(doc._id === 'id4'){
                    assert.strictEqual(doc.minScore, 5);
                } else{
                    assert.strictEqual(doc.minScore, 15);
                }
            });
            //update all docs using updateMany API with $min operator to set the minScore to 50
            const updateManyResp1 = await collection.updateMany({ }, { '$min': { 'minScore': 50 } });
            assert.strictEqual(updateManyResp1.matchedCount, 20);
            assert.strictEqual(updateManyResp1.modifiedCount, 0);
            assert.strictEqual(updateManyResp1.acknowledged, true);
            assert.strictEqual(updateManyResp1.upsertedCount, undefined);
            assert.strictEqual(updateManyResp1.upsertedId, undefined);
            const allDocs1 = await collection.find({ }).toArray();
            //assert that the minScore field is not set to 50 in all docs because the $min operator does not set the field value to new value when the new value is greater than existing value
            allDocs1.forEach(doc => {
                if(doc._id === 'id4'){
                    assert.strictEqual(doc.minScore, 5);
                } else{
                    assert.strictEqual(doc.minScore, 15);
                }
            });
        });
        it('should set a field value to new value when the new value is > existing value with $max in updateOne and updateMany', async () => {
            const docList = Array.from({ length: 20 }, () => ({ _id : 'id', departmentName: 'dept', minScore: 50, maxScore: 800 }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.departmentName = doc.departmentName + index;        
                if(index == 4){
                    doc.maxScore = 900;
                }
            });
            //insert all docs
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update the 4th doc using updateOne API with $max operator to set the maxScore to 5
            const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$max': { 'maxScore': 950 } });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id4' });
            //assert that the maxScore field is set to 950 in the 4th doc because the $max operator sets the field value to new value when the new value is greater than existing value
            assert.strictEqual(updatedDoc!.maxScore, 950);
            //update the 4th doc using updateOne API with $max operator to set the maxScore to 15
            const updateOneResp1 = await collection.updateOne({ '_id': 'id4' }, { '$max': { 'maxScore': 15 } });
            assert.strictEqual(updateOneResp1.matchedCount, 1);
            assert.strictEqual(updateOneResp1.modifiedCount, 0);
            assert.strictEqual(updateOneResp1.acknowledged, true);
            assert.strictEqual(updateOneResp1.upsertedCount, undefined);
            assert.strictEqual(updateOneResp1.upsertedId, undefined);
            const updatedDoc1 = await collection.findOne({ '_id': 'id4' });
            //assert that the maxScore field is not set to 15 in the 5th doc because the $max operator does not set the field value to new value when the new value is lesser than existing value
            assert.strictEqual(updatedDoc1!.maxScore, 950);    
            //update all docs using updateMany API with $max operator to set the maxScore to 15
            const updateManyResp = await collection.updateMany({ }, { '$max': { 'maxScore': 900 } });
            assert.strictEqual(updateManyResp.matchedCount, 20);
            assert.strictEqual(updateManyResp.modifiedCount, 19);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const allDocs = await collection.find({ }).toArray();
            //assert that the maxScore field is set to 900 in all docs because the $max operator sets the field value to new value when the new value is greater than existing value
            allDocs.forEach(doc => {
                if(doc._id === 'id4'){
                    assert.strictEqual(doc.maxScore, 950);
                } else{
                    assert.strictEqual(doc.maxScore, 900);
                }
            });
            //update all docs using updateMany API with $max operator to set the maxScore to 50
            const updateManyResp1 = await collection.updateMany({ }, { '$max': { 'maxScore': 50 } });
            assert.strictEqual(updateManyResp1.matchedCount, 20);
            assert.strictEqual(updateManyResp1.modifiedCount, 0);
            assert.strictEqual(updateManyResp1.acknowledged, true);
            assert.strictEqual(updateManyResp1.upsertedCount, undefined);
            assert.strictEqual(updateManyResp1.upsertedId, undefined);
            const allDocs1 = await collection.find({ }).toArray();
            //assert that the maxScore field is not set to 50 in all docs because the $max operator does not set the field value to new value when the new value is less than existing value
            allDocs1.forEach(doc => {
                if(doc._id === 'id4'){
                    assert.strictEqual(doc.maxScore, 950);
                } else{
                    assert.strictEqual(doc.maxScore, 900);
                }
            });
        });
        it('should multiply a value by number provided for each field in the $mul in updateOne and updateMany', async () => {
            const docList = Array.from({ length: 5 }, () => ({ _id : 'id', productName: 'prod', price: 50, njStatePrice: 50 }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.productName = doc.productName + index;                
            });
            //insert all docs
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update the 4th doc using updateOne API with $mul operator to multiply the njStatePrice by 1.07
            const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$mul': { 'njStatePrice': 1.07 } });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id4' });
            //assert that the njStatePrice field is multiplied by 1.07 in the 4th doc because the $mul operator multiplies the field value by new value
            assert.strictEqual(updatedDoc!.njStatePrice, 53.5);
            //update docs using updateMany API with $mul operator to multiply the njStatePrice by 1.07
            const updateManyResp = await collection.updateMany({ '_id' : { '$in' : ['id0', 'id1', 'id2', 'id3'] } }, { '$mul': { 'njStatePrice': 1.07 } });
            assert.strictEqual(updateManyResp.matchedCount, 4);
            assert.strictEqual(updateManyResp.modifiedCount, 4);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const allDocs = await collection.find({ }).toArray();
            //assert that the njStatePrice field is multiplied by 1.07 in all docs because the $mul operator multiplies the field value by new value
            allDocs.forEach(doc => {
                assert.strictEqual(doc.njStatePrice, 53.5);
            }); 
        });
        it('should push an element to an array when an item is added using $push', async () => {
            const docList = Array.from({ length: 5 }, () => ({ _id : 'id', productName: 'prod', tags: ['tag1', 'tag2'] }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.productName = doc.productName + index; 
            });
            //insert all docs
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update the 4th doc using updateOne API with $push operator to push the tag3 to the tags array
            const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$push': { 'tags': 'tag3' } });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id4' });
            //assert that the tag3 is pushed to the tags array in the 4th doc because the $push operator pushes the item to the array
            assert.strictEqual(updatedDoc!.tags.length, 3);
            assert.strictEqual(updatedDoc!.tags[2], 'tag3');
            //update docs using updateMany API with $push operator to push the tag3 to the tags array
            const updateManyResp = await collection.updateMany({}, { '$push': { 'tags': 'tag3' } });
            assert.strictEqual(updateManyResp.matchedCount, 5);
            assert.strictEqual(updateManyResp.modifiedCount, 5);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const allDocs = await collection.find({ }).toArray();
            assert.strictEqual(allDocs.length, 5);
            //assert that the tag3 is pushed to the tags array in all docs because the $push operator pushes the item to the array
            allDocs.forEach(doc => {
                if(doc._id === 'id4'){
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
            const docList = Array.from({ length: 5 }, () => ({ _id : 'id', productName: 'prod', tags: ['tag1', 'tag2'] }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.productName = doc.productName + index; 
            });
            //insert all docs
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update the 4th doc using updateOne API with $push operator to push the tag3 and tag4 to the tags array at position 1
            const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$push': { 'tags': { '$each': ['tag3', 'tag4'], '$position': 1 } } });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id4' });
            //assert that the tag3 and tag4 are pushed to the tags array in the 4th doc at position 1 because the $push operator pushes the item to the array
            assert.strictEqual(updatedDoc!.tags.length, 4);
            assert.strictEqual(updatedDoc!.tags[1], 'tag3');
            assert.strictEqual(updatedDoc!.tags[2], 'tag4');
            //update docs using updateMany API with $push operator to push the tag3 and tag4 to the tags array at position 1
            const updateManyResp = await collection.updateMany({}, { '$push': { 'tags': { '$each': ['tag3', 'tag4'], '$position': 1 } } });
            assert.strictEqual(updateManyResp.matchedCount, 5);
            assert.strictEqual(updateManyResp.modifiedCount, 5);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const allDocs = await collection.find({ }).toArray();
            assert.strictEqual(allDocs.length, 5);
            //assert that the tag3 and tag4 are pushed to the tags array in all docs at position 1 because the $push operator pushes the item to the array
            allDocs.forEach(doc => {
                if(doc._id === 'id4'){
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
            const docList = Array.from({ length: 5 }, () => ({ _id : 'id', productName: 'prod', tags: ['tag1', 'tag2'] }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.productName = doc.productName + index; 
            });
            //insert all docs
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update the 4th doc using updateOne API with $addToSet operator to add the tag3 to the tags array
            const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$addToSet': { 'tags': 'tag3' } });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id4' });
            //assert that the tag3 is added to the tags array in the 4th doc because the $addToSet operator adds the item to the array
            assert.strictEqual(updatedDoc!.tags.length, 3);
            assert.strictEqual(updatedDoc!.tags[2], 'tag3');
            //update 4th doc using updateOne API with $addToSet operator to add the tag3 to the tags array again and this should be a no-op
            const updateOneResp2 = await collection.updateOne({ '_id': 'id4' }, { '$addToSet': { 'tags': 'tag3' } });
            assert.strictEqual(updateOneResp2.matchedCount, 1);
            assert.strictEqual(updateOneResp2.modifiedCount, 0);
            assert.strictEqual(updateOneResp2.acknowledged, true);
            assert.strictEqual(updateOneResp2.upsertedCount, undefined);
            assert.strictEqual(updateOneResp2.upsertedId, undefined);
            const updatedDoc2 = await collection.findOne({ '_id': 'id4' });
            //assert that the tag3 is not added to the tags array in the 4th doc because the $addToSet operator does not add the item to the array if it already exists
            assert.strictEqual(updatedDoc2!.tags.length, 3);
            assert.strictEqual(updatedDoc2!.tags[2], 'tag3');
            //update docs using updateMany API with $addToSet operator to add the tag3 to the tags array
            const updateManyResp = await collection.updateMany({}, { '$addToSet': { 'tags': 'tag3' } });
            assert.strictEqual(updateManyResp.matchedCount, 5);
            assert.strictEqual(updateManyResp.modifiedCount, 4);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const allDocs = await collection.find({ }).toArray();
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
            assert.strictEqual(updateManyResp2.acknowledged, true);
            assert.strictEqual(updateManyResp2.upsertedCount, undefined);
            assert.strictEqual(updateManyResp2.upsertedId, undefined);
            const allDocs2 = await collection.find({ }).toArray();
            assert.strictEqual(allDocs2.length, 5);
            //assert that the tag3 is not added to the tags array in all docs because the $addToSet operator does not add the item to the array if it already exists
            allDocs2.forEach(doc => {
                assert.strictEqual(doc.tags.length, 3);
                assert.strictEqual(doc.tags[2], 'tag3');
            });
        });
        it('should push an element to an array skipping duplicates when an item is added using $addToSet with $each', async () => {
            const docList = Array.from({ length: 5 }, () => ({ _id : 'id', productName: 'prod', tags: ['tag1', 'tag2'] }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.productName = doc.productName + index; 
            });
            //insert all docs
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update the 4th doc using updateOne API with $addToSet operator to add the tag3 and tag4 to the tags array
            const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$addToSet': { 'tags': { '$each' : ['tag3', 'tag4'] } } });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id4' });
            //assert that the tag3 and tag4 added to the tags array in the 4th doc because the $addToSet operator adds the item to the array
            assert.strictEqual(updatedDoc!.tags.length, 4);
            assert.strictEqual(updatedDoc!.tags[2], 'tag3');
            assert.strictEqual(updatedDoc!.tags[3], 'tag4');
            //update 4th doc using updateOne API with $addToSet operator to add the tag3 and tab4 to the tags array again and this should be a no-op
            const updateOneResp2 = await collection.updateOne({ '_id': 'id4' }, { '$addToSet': { 'tags': { '$each' : ['tag3', 'tag4'] } } });
            assert.strictEqual(updateOneResp2.matchedCount, 1);
            assert.strictEqual(updateOneResp2.modifiedCount, 0);
            assert.strictEqual(updateOneResp2.acknowledged, true);
            assert.strictEqual(updateOneResp2.upsertedCount, undefined);
            assert.strictEqual(updateOneResp2.upsertedId, undefined);
            await collection.findOne({ '_id': 'id4' });
            //assert that the tag3 and tag4 are not added to the tags array in the 4th doc because the $addToSet operator does not add the item to the array if it already exists
            assert.strictEqual(updatedDoc!.tags.length, 4);
            assert.strictEqual(updatedDoc!.tags[2], 'tag3');
            assert.strictEqual(updatedDoc!.tags[3], 'tag4');
            //update docs using updateMany API with $addToSet operator to add the tag3 and tag4 to the tags array
            const updateManyResp = await collection.updateMany({}, { '$addToSet': { 'tags': { '$each' : ['tag3', 'tag4'] } } });
            assert.strictEqual(updateManyResp.matchedCount, 5);
            assert.strictEqual(updateManyResp.modifiedCount, 4);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const allDocs = await collection.find({ }).toArray();
            assert.strictEqual(allDocs.length, 5);
            //assert that the tag3 and tag4 are added to the tags array in all docs because the $addToSet operator adds the item to the array
            allDocs.forEach(doc => {
                assert.strictEqual(doc.tags.length, 4);
                assert.strictEqual(doc.tags[2], 'tag3');
                assert.strictEqual(doc.tags[3], 'tag4');
            });
            //update docs using updateMany API with $addToSet operator to add the tag3 and tag4 to the tags array again and this should be a no-op
            const updateManyResp2 = await collection.updateMany({}, { '$addToSet': { 'tags': { '$each' : ['tag3', 'tag4'] } } });
            assert.strictEqual(updateManyResp2.matchedCount, 5);
            assert.strictEqual(updateManyResp2.modifiedCount, 0);
            assert.strictEqual(updateManyResp2.acknowledged, true);
            assert.strictEqual(updateManyResp2.upsertedCount, undefined);
            assert.strictEqual(updateManyResp2.upsertedId, undefined);
            const allDocs2 = await collection.find({ }).toArray();
            assert.strictEqual(allDocs2.length, 5);
            //assert that the tag3 & tag4 are not added to the tags array in all docs because the $addToSet operator does not add the item to the array if it already exists
            allDocs2.forEach(doc => {
                assert.strictEqual(doc.tags.length, 4);
                assert.strictEqual(doc.tags[2], 'tag3');
                assert.strictEqual(doc.tags[3], 'tag4');
            });
        });
        it('should remove last 1 item from array when $pop is passed with 1 in updateOne and updateMany', async () => {
            const docList = Array.from({ length: 5 }, () => ({ _id : 'id', productName: 'prod', tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'] }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.productName = doc.productName + index; 
            });
            //insert all docs
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update the 4th doc using updateOne API with $pop operator to remove the last 1 item from the tags array
            const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$pop': { 'tags': 1 } });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id4' });
            //assert that the last 2 items are removed from the tags array in the 4th doc because the $pop operator removes the items from the array
            assert.strictEqual(updatedDoc!.tags.length, 4);
            assert.strictEqual(updatedDoc!.tags[0], 'tag1');
            assert.strictEqual(updatedDoc!.tags[1], 'tag2');
            assert.strictEqual(updatedDoc!.tags[2], 'tag3');
            assert.strictEqual(updatedDoc!.tags[3], 'tag4');
            //update docs using updateMany API with $pop operator to remove the last 1 item from the tags array
            const updateManyResp = await collection.updateMany({}, { '$pop': { 'tags': 1 } });
            assert.strictEqual(updateManyResp.matchedCount, 5);
            assert.strictEqual(updateManyResp.modifiedCount, 5);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const allDocs = await collection.find({ }).toArray();
            assert.strictEqual(allDocs.length, 5);
            //assert that the last 2 items are removed from the tags array in all docs because the $pop operator removes the items from the array
            allDocs.forEach(doc => {
                if(doc._id === 'id4'){
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
            const docList = Array.from({ length: 5 }, () => ({ _id : 'id', productName: 'prod', tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'] }));
            docList.forEach((doc, index) => {
                doc._id += index;
                doc.productName = doc.productName + index; 
            });
            //insert all docs
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, docList.length);
            assert.strictEqual(res.acknowledged, true);
            assert.strictEqual(Object.keys(res.insertedIds).length, docList.length);
            //update the 4th doc using updateOne API with $pop operator to remove the first 1 item from the tags array
            const updateOneResp = await collection.updateOne({ '_id': 'id4' }, { '$pop': { 'tags': -1 } });
            assert.strictEqual(updateOneResp.matchedCount, 1);
            assert.strictEqual(updateOneResp.modifiedCount, 1);
            assert.strictEqual(updateOneResp.acknowledged, true);
            assert.strictEqual(updateOneResp.upsertedCount, undefined);
            assert.strictEqual(updateOneResp.upsertedId, undefined);
            const updatedDoc = await collection.findOne({ '_id': 'id4' });
            //assert that the last 2 items are removed from the tags array in the 4th doc because the $pop operator removes the items from the array
            assert.strictEqual(updatedDoc!.tags.length, 4);
            assert.strictEqual(updatedDoc!.tags[0], 'tag2');
            assert.strictEqual(updatedDoc!.tags[1], 'tag3');
            assert.strictEqual(updatedDoc!.tags[2], 'tag4');
            assert.strictEqual(updatedDoc!.tags[3], 'tag5');
            //update docs using updateMany API with $pop operator to remove the first 1 item from the tags array
            const updateManyResp = await collection.updateMany({}, { '$pop': { 'tags': -1 } });
            assert.strictEqual(updateManyResp.matchedCount, 5);
            assert.strictEqual(updateManyResp.modifiedCount, 5);
            assert.strictEqual(updateManyResp.acknowledged, true);
            assert.strictEqual(updateManyResp.upsertedCount, undefined);
            assert.strictEqual(updateManyResp.upsertedId, undefined);
            const allDocs = await collection.find({ }).toArray();
            assert.strictEqual(allDocs.length, 5);
            //assert that the last 2 items are removed from the tags array in all docs because the $pop operator removes the items from the array
            allDocs.forEach(doc => {
                if(doc._id === 'id4'){
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
        it('should make _id an ObjectId when upserting with no _id', async () => {
            await collection.deleteMany({});
            const { upsertedId } = await collection.updateMany(
                {},
                {
                    '$set': {
                        'username': 'aaronm'
                    }
                },
                {
                    'upsert': true
                }
            );
            assert.ok(upsertedId.match(/^[a-f\d]{24}$/i), upsertedId);
        });
    });
    describe('findOneAndUpdate tests', () => {
        it('should findOneAndUpdate', async () => {
            const res = await collection.insertOne(createSampleDocWithMultiLevel());
            const docId = res.insertedId;
            const findOneAndUpdateResp = await collection.findOneAndUpdate({ '_id': docId },
                {
                    '$set': {
                        'username': 'aaronm'
                    },
                    '$unset': {
                        'address.city': ''
                    }
                },
                {
                    'returnDocument': 'after'
                }
            );
            assert.strictEqual(findOneAndUpdateResp.ok, 1);
            assert.strictEqual(findOneAndUpdateResp.value!._id, docId);
            assert.strictEqual(findOneAndUpdateResp.value!.username, 'aaronm');
            assert.strictEqual(findOneAndUpdateResp.value!.address.city, undefined);
        });
        it('should findOneAndUpdate with returnDocument before', async () => {
            const docToInsert = createSampleDocWithMultiLevel();
            const res = await collection.insertOne(docToInsert);
            const docId = res.insertedId;
            const cityBefore = docToInsert.address?.city;
            const usernameBefore = docToInsert.username;
            const findOneAndUpdateResp = await collection.findOneAndUpdate({ '_id': docId },
                {
                    '$set': {
                        'username': 'aaronm'
                    },
                    '$unset': {
                        'address.city': ''
                    }
                },
                {
                    'returnDocument': 'before'
                }
            );
            assert.strictEqual(findOneAndUpdateResp.ok, 1);
            assert.strictEqual(findOneAndUpdateResp.value!._id, docId);
            assert.strictEqual(findOneAndUpdateResp.value!.username, usernameBefore);
            assert.strictEqual(findOneAndUpdateResp.value!.address.city, cityBefore);
        });
        it('should findOneAndUpdate with upsert true', async () => {
            await collection.insertOne(createSampleDocWithMultiLevel());
            const newDocId = '123';
            const findOneAndUpdateResp = await collection.findOneAndUpdate({ '_id': newDocId },
                {
                    '$set': {
                        'username': 'aaronm'
                    },
                    '$unset': {
                        'address.city': ''
                    }
                },
                {
                    'returnDocument': 'after',
                    'upsert': true
                }
            );
            assert.strictEqual(findOneAndUpdateResp.ok, 1);
            assert.strictEqual(findOneAndUpdateResp.value!._id, newDocId);
            assert.strictEqual(findOneAndUpdateResp.value!.username, 'aaronm');
            assert.strictEqual(findOneAndUpdateResp.value!.address, undefined);
        });
        it('should findOneAndUpdate with upsert true and returnDocument before', async () => {
            await collection.insertOne(createSampleDocWithMultiLevel());
            const newDocId = '123';
            const findOneAndUpdateResp = await collection.findOneAndUpdate({ '_id': newDocId },
                {
                    '$set': {
                        'username': 'aaronm'
                    },
                    '$unset': {
                        'address.city': ''
                    }
                },
                {
                    'returnDocument': 'before',
                    'upsert': true
                }
            );
            assert.strictEqual(findOneAndUpdateResp.ok, 1);
            assert.strictEqual(findOneAndUpdateResp.value, null);
        });
        it('should make _id an ObjectId when upserting with no _id', async () => {
            await collection.deleteMany({});
            const { value } = await collection.findOneAndUpdate(
                {},
                {
                    '$set': {
                        'username': 'aaronm'
                    }
                },
                {
                    'returnDocument': 'after',
                    'upsert': true
                }
            );
            assert.ok(value!._id!.toString().match(/^[a-f\d]{24}$/i), value!._id!.toString());
        });
    });
    describe('deleteOne tests', () => {
        it('should deleteOne document', async () => {
            const res = await collection.insertOne(createSampleDocWithMultiLevel());
            const docId = res.insertedId;
            const deleteOneResp = await collection.deleteOne({ _id: docId });
            assert.strictEqual(deleteOneResp.deletedCount, 1);
            assert.strictEqual(deleteOneResp.acknowledged, true);
        });
        it('should not delete any when no match in deleteOne', async () => {
            await collection.insertOne(createSampleDocWithMultiLevel());
            const deleteOneResp = await collection.deleteOne({ 'username': 'samlxyz' });
            assert.strictEqual(deleteOneResp.deletedCount, 0);
            assert.strictEqual(deleteOneResp.acknowledged, true);
        });
    });
    describe('deleteMany tests', () => {
        it('should deleteMany when match is <= 20', async () => {
            const docList = Array.from({ length: 20 }, () => ({ 'username': 'id', 'city': 'trichy' }));
            docList.forEach((doc, index) => {
                doc.username = doc.username + (index + 1);
            });
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, 20);
            const deleteManyResp = await collection.deleteMany({ 'city': 'trichy' });
            assert.strictEqual(deleteManyResp.deletedCount, 20);
            assert.strictEqual(deleteManyResp.acknowledged, true);
        });
        it('should throw an error when deleteMany finds more than 20 records', async () => {
            const docList = Array.from({ length: 20 }, () => ({ 'username': 'id', 'city': 'trichy' }));
            docList.forEach((doc, index) => {
                doc.username = doc.username + (index + 1);
            });
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, 20);
            //insert next 20
            const docListNextSet = Array.from({ length: 20 }, () => ({ username: 'id', city: 'trichy' }));
            docListNextSet.forEach((doc, index) => {
                doc.username = doc.username + (index + 21);
            });
            const resNextSet = await collection.insertMany(docListNextSet);
            assert.strictEqual(resNextSet.insertedCount, docListNextSet.length);
            assert.strictEqual(resNextSet.acknowledged, true);
            assert.strictEqual(Object.keys(resNextSet.insertedIds).length, docListNextSet.length);
            //test for deleteMany errors
            let exception: any;
            const filter = { 'city': 'trichy' };
            try {
                await collection.deleteMany(filter);
            } catch (e: any) {
                exception = e;
            }
            assert.ok(exception);
            assert.strictEqual(exception.message, 'Command "deleteMany" failed with the following error: More records found to be deleted even after deleting 20 records');
            assert.deepStrictEqual(exception.command.deleteMany.filter, filter);
        });
        it('should find with sort', async () => {
            await collection.deleteMany({});
            await collection.insertMany([
                { username: 'a' },
                { username: 'c' },
                { username: 'b' }
            ]);

            let docs = await collection.find({}, { sort: { username: 1 }, limit: 20 }).toArray();
            assert.deepStrictEqual(docs.map(doc => doc.username), ['a', 'b', 'c']);

            docs = await collection.find({}, { sort: { username: -1 }, limit: 20 }).toArray();
            assert.deepStrictEqual(docs.map(doc => doc.username), ['c', 'b', 'a']);
        });
        it('throws if using cursor with sort', async () => {
            await collection.deleteMany({});
            for (let i = 0; i < 20; ++i) {
                await collection.insertMany(Array(20).fill(0).map((_, i) => ({ num: i })));
            }
            await assert.rejects(
                async () => collection.find({}, { sort: { num: -1 }, limit: 22 }),
                /JSON API can currently only return 20 documents with sort/
            );
        });
        it('should findOne with sort', async () => {
            await collection.deleteMany({});
            await collection.insertMany([
                { username: 'a' },
                { username: 'c' },
                { username: 'b' }
            ]);

            let doc = await collection.findOne({}, { sort: { username: 1 } });
            assert.strictEqual(doc!.username, 'a');

            doc = await collection.findOne({}, { sort: { username: -1 } });
            assert.deepStrictEqual(doc!.username, 'c');
        });
        it('should findOneAndUpdate with sort', async () => {
            await collection.deleteMany({});
            await collection.insertMany([
                { username: 'a' },
                { username: 'c' },
                { username: 'b' }
            ]);

            let res = await collection.findOneAndUpdate(
                {},
                { $set: { username: 'aaa' } },
                { sort: { username: 1 }, returnDocument: 'before' }
            );
            assert.strictEqual(res.value!.username, 'a');

            res = await collection.findOneAndUpdate(
                {},
                { $set: { username: 'ccc' } },
                { sort: { username: -1 }, returnDocument: 'before' }
            );
            assert.deepStrictEqual(res.value!.username, 'c');
        });
        it('should findOneAndReplace with sort', async () => {
            await collection.deleteMany({});
            await collection.insertMany([
                { username: 'a', answer: 42 },
                { username: 'c', answer: 42 },
                { username: 'b', answer: 42 }
            ]);

            let res = await collection.findOneAndReplace(
                {},
                { username: 'aaa' },
                { sort: { username: 1 }, returnDocument: 'before' }
            );
            assert.strictEqual(res.value!.username, 'a');

            res = await collection.findOneAndReplace(
                {},
                { username: 'ccc' },
                { sort: { username: -1 }, returnDocument: 'before' }
            );
            assert.deepStrictEqual(res.value!.username, 'c');

            const docs = await collection.find({}, { sort: { username: 1 }, limit: 20 }).toArray();
            assert.deepStrictEqual(docs.map(doc => doc.answer), [undefined, 42, undefined]);
        });
        it('findOneAndReplace should make _id an ObjectId when upserting with no _id', async () => {
            await collection.deleteMany({});
            const { value } = await collection.findOneAndReplace(
                {},
                {
                    'username': 'aaronm'
                },
                {
                    'returnDocument': 'after',
                    'upsert': true
                }
            );
            // @ts-ignore
            assert.ok(value!._id!.match(/^[a-f\d]{24}$/i), value!._id);
        });
        it('should findOneAndUpdate without any updates to apply', async () => {
            await collection.deleteMany({});
            await collection.insertMany([
                { username: 'a' }
            ]);

            const res = await collection.findOneAndUpdate(
                {},
                { $set: { username: 'a' } },
                { sort: { username: 1 }, returnDocument: 'before' }
            );
            assert.strictEqual(res.value!.username, 'a');
        });
        it('should countDocuments()', async () => {
            await collection.deleteMany({});
            await collection.insertMany([
                { username: 'a' },
                { username: 'aa', answer: 42 },
                { username: 'aaa', answer: 42 }
            ]);

            let count = await collection.countDocuments();
            assert.strictEqual(count, 3);

            count = await collection.countDocuments({ username: 'a' });
            assert.strictEqual(count, 1);

            count = await collection.countDocuments({ answer: 42 });
            assert.strictEqual(count, 2);
        });
        it('supports count() as alias for countDocuments()', async () => {
            await collection.deleteMany({});
            await collection.insertMany([
                { username: 'a' },
                { username: 'aa', answer: 42 },
                { username: 'aaa', answer: 42 }
            ]);

            let count = await collection.count();
            assert.strictEqual(count, 3);

            count = await collection.count({ username: 'a' });
            assert.strictEqual(count, 1);

            count = await collection.count({ answer: 42 });
            assert.strictEqual(count, 2);
        });
        it('supports findOneAndDelete()', async () => {
            await collection.deleteMany({});
            await collection.insertMany([
                { username: 'a' },
                { username: 'b' },
                { username: 'c' }
            ]);

            let res = await collection.findOneAndDelete({ username: 'a' });
            assert.strictEqual(res.value!.username, 'a');

            res = await collection.findOneAndDelete({}, { sort: { username: -1 } });
            assert.strictEqual(res.value!.username, 'c');
        });
        it('stores BigInts as numbers', async () => {
            await collection.deleteMany({});
            await collection.insertOne({
                _id: 'bigint-test',
                answer: 42n
            });

            const res = await collection.findOne({ _id: 'bigint-test' });
            assert.strictEqual(res!.answer, 42);
        });
        it('should deleteOne with sort', async () => {
            await collection.deleteMany({});
            await collection.insertMany([
                { username: 'a' },
                { username: 'c' },
                { username: 'b' }
            ]);

            await collection.deleteOne(
                {},
                { sort: { username: 1 } }
            );

            const docs = await collection.find({}, { sort: { username: 1 }, limit: 20 }).toArray();
            assert.deepStrictEqual(docs.map(doc => doc.username), ['b', 'c']);
        });
        it.skip('should updateOne with sort', async () => {
            // jsonapi currently doesn't support updateOne with sort
            await collection.deleteMany({});
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

            const docs = await collection.find({}, { sort: { username: 1 } }).toArray();
            assert.deepStrictEqual(docs.map(doc => doc.username), ['aa', 'b', 'c']);
        });
    });
    describe('countDocuments tests', () => {
        it('should return count of documents with non id filter', async () => {
            const docList = Array.from({ length: 20 }, () => ({ 'username': 'id', 'city': 'trichy' }));
            docList.forEach((doc, index) => {
                doc.username = doc.username + (index + 1);
            });
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, 20);
            const count = await collection.countDocuments({ 'city': 'trichy' });
            assert.strictEqual(count, 20);
        });
        it('should return count of documents with no filter', async () => {
            const docList = Array.from({ length: 20 }, () => ({ 'username': 'id', 'city': 'trichy' }));
            docList.forEach((doc, index) => {
                doc.username = doc.username + (index + 1);
            });
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, 20);
            const count = await collection.countDocuments({});
            assert.strictEqual(count, 20);
        });
        it('should return count of documents for more than default page size limit', async () => {
            const docList = Array.from({ length: 20 }, () => ({ 'username': 'id', 'city': 'trichy' }));
            docList.forEach((doc, index) => {
                doc.username = doc.username + (index + 1);
            });
            const res = await collection.insertMany(docList);
            assert.strictEqual(res.insertedCount, 20);
            //insert next 20
            const docListNextSet = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
            docListNextSet.forEach((doc, index) => {
                doc.username = doc.username + (index + 21);
            });
            const resNextSet = await collection.insertMany(docListNextSet);
            assert.strictEqual(resNextSet.insertedCount, docListNextSet.length);
            assert.strictEqual(resNextSet.acknowledged, true);
            assert.strictEqual(Object.keys(resNextSet.insertedIds).length, docListNextSet.length);
            //verify counts
            assert.strictEqual(await collection.countDocuments({ city: 'nyc' }), 20);
            assert.strictEqual(await collection.countDocuments({ city: 'trichy' }), 20);
            assert.strictEqual(await collection.countDocuments({ city: 'chennai' }), 0);
            assert.strictEqual(await collection.countDocuments({}), 40);
        });
        it('should return 0 when no documents are in the collection', async () => {
            const count = await collection.countDocuments({});
            assert.strictEqual(count, 0);
        });
    });
});
