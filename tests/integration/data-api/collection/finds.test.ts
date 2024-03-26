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

import { Collection } from '@/src/data-api';
import {
  createSampleDoc2WithMultiLevel,
  createSampleDoc3WithMultiLevel,
  createSampleDocWithMultiLevel,
  testClient
} from '@/tests/fixtures';
import assert from 'assert';

// I was going to go through split this up but yeah... no
// Don't want to spend too much time sifting through a thousand lines of intertwined tests
describe('integration.data-api.collection.finds', () => {
  let collection: Collection;

  before(async function () {
    if (testClient == null) {
      return this.skip();
    }
    [, , collection] = await testClient.new();
  });

  afterEach(async () => {
    await collection.deleteAll();
  });


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

  it('should find & findOne ne document', async () => {
    const insertDocResp1 = await collection.insertOne(createSampleDocWithMultiLevel());
    const insertDocResp2 = await collection.insertOne(createSampleDoc2WithMultiLevel());
    const idToCheck1 = insertDocResp1.insertedId;
    const idToCheck2 = insertDocResp2.insertedId;
    const filter = { '_id': { '$ne': idToCheck1 } };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck2);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck2);

    const filter1 = { '_id': { '$ne': idToCheck2 } };
    const resDoc1 = await collection.findOne(filter1);
    assert.ok(resDoc1);
    assert.strictEqual(resDoc1._id, idToCheck1);
    const findResDocs1 = await collection.find(filter1).toArray();
    assert.strictEqual(findResDocs1.length, 1);
    assert.strictEqual(findResDocs1[0]._id, idToCheck1);
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

  it('should find & findOne L1 String NE $ne document', async () => {
    const doc1 = createSampleDocWithMultiLevel();
    const doc2 = createSampleDoc2WithMultiLevel();
    await collection.insertOne(doc1);
    const insertDocResp2 = await collection.insertOne(doc2);
    const idToCheck2 = insertDocResp2.insertedId;
    const filter = { 'username': { '$ne': doc1.username } };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck2);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck2);
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

  it('should find & findOne L1 Number NE $ne document', async () => {
    const doc1 = createSampleDocWithMultiLevel();
    const doc2 = createSampleDoc2WithMultiLevel();
    await collection.insertOne(doc1);
    const insertDocResp2 = await collection.insertOne(doc2);
    const idToCheck2 = insertDocResp2.insertedId;
    const filter = { 'age': { '$ne': doc1.age } };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck2);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck2);
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

  it('should find & findOne L1 Boolean NE $ne document', async () => {
    const doc1 = createSampleDoc2WithMultiLevel();
    const doc2 = createSampleDoc3WithMultiLevel();
    const insertDocResp1 = await collection.insertOne(doc1);
    await collection.insertOne(doc2);
    const idToCheck1 = insertDocResp1.insertedId;
    const filter = { 'human': { '$ne': false } };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck1);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck1);
  });

  it('should find & findOne L1 Null EQ document', async () => {
    const doc = createSampleDocWithMultiLevel();
    const insertDocResp = await collection.insertOne(doc);
    const idToCheck = insertDocResp.insertedId;
    const filter = { 'password': null};
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
    const filter = { 'password': { '$eq': null } };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck);
  });

  it('should find & findOne L1 Null NE $ne document', async () => {
    const doc1 = createSampleDocWithMultiLevel();
    const doc2 = createSampleDoc2WithMultiLevel();
    await collection.insertOne(doc1);
    const insertDocResp2 = await collection.insertOne(doc2);
    const idToCheck2 = insertDocResp2.insertedId;
    const filter = { 'password': { '$ne': doc1.password } };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck2);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck2);
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

  it('should find & findOne any level String NE $ne document', async () => {
    const doc1 = createSampleDocWithMultiLevel();
    const doc2 = createSampleDoc2WithMultiLevel();
    const insertDocResp1 = await collection.insertOne(doc1);
    await collection.insertOne(doc2);
    const idToCheck1 = insertDocResp1.insertedId;
    const filter = { 'address.street': { '$ne': doc2.address?.street } };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck1);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck1);
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

  it('should find & findOne any level Number NE $ne document', async () => {
    const doc1 = createSampleDocWithMultiLevel();
    const doc2 = createSampleDoc2WithMultiLevel();
    await collection.insertOne(doc1);
    const insertDocResp2 = await collection.insertOne(doc2);
    const idToCheck2 = insertDocResp2.insertedId;
    const filter = { 'address.number': { '$ne': doc1.address?.number } };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck2);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck2);
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

  it('should find & findOne any level Boolean NE $ne document', async () => {
    const doc1 = createSampleDocWithMultiLevel();
    const doc2 = createSampleDoc2WithMultiLevel();
    await collection.insertOne(doc1);
    const insertDocResp2 = await collection.insertOne(doc2);
    const idToCheck2 = insertDocResp2.insertedId;
    const filter = { 'address.is_office': { '$ne': doc1.address?.is_office } };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck2);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck2);
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

  it('should find & findOne any level Null EQ $ne document', async () => {
    const doc1 = createSampleDocWithMultiLevel();
    const doc2 = createSampleDoc2WithMultiLevel();
    await collection.insertOne(doc1);
    const insertDocResp2 = await collection.insertOne(doc2);
    const idToCheck2 = insertDocResp2.insertedId;
    const filter = { 'address.suburb': { '$ne': doc1.address?.suburb } };
    const resDoc = await collection.findOne(filter);
    assert.ok(resDoc);
    assert.strictEqual(resDoc._id, idToCheck2);
    const findResDocs = await collection.find(filter).toArray();
    assert.strictEqual(findResDocs.length, 1);
    assert.strictEqual(findResDocs[0]._id, idToCheck2);
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
    const filter = {
      'address.number': doc.address?.number,
      'address.street': doc.address?.street,
      'address.is_office': doc.address?.is_office
    };
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
    const filter = {
      'age': doc.age,
      'address.street': doc.address?.street,
      'address.is_office': doc.address?.is_office
    };
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
    const findCursor = collection.find({ '_id': idToCheck }, {
      projection: {
        username: 1,
        'address.city': true
      }
    });
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
    const findCursor = collection.find({ '_id': idToCheck }, {
      projection: {
        username: 1,
        'address.city': true,
        _id: 0
      }
    });
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
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    //read that back with projection
    const findDocs = await collection.find({}, {
      projection: {
        username: 1,
        'address.city': true,
        _id: 0,
        tags: { '$slice': 1 }
      }
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
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    //read that back with projection
    const findDocs = await collection.find({}, {
      projection: {
        username: 1,
        'address.city': true,
        _id: 0,
        tags: { '$slice': -1 }
      }
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
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    //read that back with projection
    const findDocs = await collection.find({}, {
      projection: {
        username: 1,
        'address.city': true,
        _id: 0,
        tags: { '$slice': 6 }
      }
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
    assert.strictEqual(Object.keys(res.insertedIds).length, 20);
    //read that back with projection
    const findDocs = await collection.find({}, {
      projection: {
        username: 1,
        'address.city': true,
        _id: 0,
        tags: { '$slice': -6 }
      }
    }).toArray();
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
    interface Doc {
      _id?: string;
      username: string;
      city: string;
      tags?: string[];
    }

    const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
    docList.forEach((doc, index) => {
      doc._id = 'id' + index;
      doc.username = doc.username + (index + 1);
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
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

  it('should find & find doc $nin test', async () => {
    interface Doc {
      _id?: string;
      username?: string;
      city: string;
      tags?: string[];
    }

    const docList_nyc: Doc[] = Array.from({ length: 3 }, () => ({ city: 'nyc' }));
    docList_nyc.forEach((doc, index) => {
      doc.city = doc.city + (index + 1);
    });
    const docList_seattle: Doc[] = Array.from({ length: 2 }, () => ({ city: 'seattle' }));
    docList_seattle.forEach((doc, index) => {
      doc.city = doc.city + (index + 1);
    });
    const res = await collection.insertMany(docList_nyc);
    assert.strictEqual(res.insertedCount, docList_nyc.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 3);
    const res1 = await collection.insertMany(docList_seattle);
    assert.strictEqual(res1.insertedCount, docList_seattle.length);
    assert.strictEqual(Object.keys(res1.insertedIds).length, 2);

    const cityArr = ['nyc1', 'nyc2', 'nyc3'];
    const filter = { 'city': { '$nin': cityArr } };
    const findRespDocs = await collection.find(filter).toArray();
    assert.strictEqual(findRespDocs.length, 2);
    //check if found docs city field starts with seattle
    findRespDocs.forEach((doc) => {
      assert.ok(doc.city.startsWith('seattle'));
    });
  });

  it('should find & find doc $exists true test', async () => {
    interface Doc {
      _id?: string;
      username: string;
      city: string;
      tags?: string[];
    }

    const docList: Doc[] = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
    docList.forEach((doc, index) => {
      doc._id = 'id' + index;
      doc.username = doc.username + (index + 1);
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
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

  it('should find & find doc $exists false test', async () => {
    interface Doc {
      _id?: string;
      username: string;
      city?: string;
      tags?: string[];
    }

    const docList: Doc[] = Array.from({ length: 10 }, () => ({ username: 'withCity', city: 'nyc' }));
    docList.forEach((doc, index) => {
      doc.username = doc.username + (index + 1);
    });
    const docList_noCity: Doc[] = Array.from({ length: 10 }, () => ({ username: 'noCity' }));
    docList.forEach((doc, index) => {
      doc.username = doc.username + (index + 1);
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, docList.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, 10);
    const res1 = await collection.insertMany(docList_noCity);
    assert.strictEqual(res1.insertedCount, docList_noCity.length);
    assert.strictEqual(Object.keys(res1.insertedIds).length, 10);
    const filter = { 'city': { '$exists': false } };
    const findRespDocs = await collection.find(filter).toArray();
    assert.strictEqual(findRespDocs.length, 10);
    //check city is not in return list
    findRespDocs.forEach((doc) => {
      assert.ok(doc._id);
      assert.ok(!doc.city);
    });
  });

  it('should find & find doc $all test', async () => {
    interface Doc {
      _id?: string;
      username: string;
      city: string;
      tags?: string[];
    }

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
    interface Doc {
      _id?: string;
      username: string;
      city: string;
      tags?: string[];
    }

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
    interface Doc {
      _id?: string;
      username: string;
      city: string;
      tags?: string[];
    }

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
