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

import process from 'process';
import { DataAPIClient } from '@/src/client';
import { DEFAULT_NAMESPACE } from '@/src/api';
import { DEFAULT_COLLECTION_NAME, initTestObjects } from '@/tests/fixtures';
import assert from 'assert';
import { Collection, ObjectId, UUID } from '@/src/data-api';

describe('integration.misc.code-samples', () => {
  const token = process.env.APPLICATION_TOKEN!;
  const endpoint = process.env.ASTRA_URI!;

  let collection: Collection;

  before(async function () {
    if (!process.env.ASTRA_URI || !process.env.APPLICATION_TOKEN) {
      this.skip();
    }
    [, , collection] = await initTestObjects(this);
  });

  beforeEach(async function () {
    await collection.deleteAll();
  });

  describe('documents', () => {
    it('works for dates', async () => {
      const client = new DataAPIClient(token);
      const db = client.db(endpoint, { namespace: DEFAULT_NAMESPACE });
      const collection = db.collection(DEFAULT_COLLECTION_NAME);

      await collection.insertOne({ dateOfBirth: new Date(1394104654000) });
      await collection.insertOne({ dateOfBirth: new Date('1863-05-28') });

      await collection.updateOne(
        {
          dateOfBirth: new Date('1863-05-28'),
        },
        {
          $set: { message: 'Happy Birthday!' },
          $currentDate: { lastModified: true },
        },
      );

      // Will print _around_ `new Date()`
      const found = await collection.findOne({ dateOfBirth: { $lt: new Date('1900-01-01') } });
      // console.log(found?.lastModified);

      assert.strictEqual(found?.message, 'Happy Birthday!');
      assert.ok(found?.lastModified instanceof Date);
      assert.strictEqual(found?.dateOfBirth.toISOString(), new Date('1863-05-28').toISOString());

      const countedDocuments = await collection.countDocuments({}, 1000);
      assert.strictEqual(countedDocuments, 2);
    });

    it('works for document IDs', async () => {
      const client = new DataAPIClient(token);
      const db = client.db(endpoint, { namespace: DEFAULT_NAMESPACE });
      const collection = db.collection(DEFAULT_COLLECTION_NAME);

      await collection.insertOne({ name: 'John', _id: UUID.v4() });
      await collection.insertOne({ name: 'Jane', _id: new UUID('016b1cac-14ce-660e-8974-026c927b9b91') });

      await collection.insertOne({ name: 'Dan', _id: new ObjectId()});
      await collection.insertOne({ name: 'Tim', _id: new ObjectId('65fd9b52d7fabba03349d013') });

      await collection.updateOne(
        { name: 'John' },
        { $set: { friendId: new UUID('016b1cac-14ce-660e-8974-026c927b9b91') } },
      );

      const john = await collection.findOne({ name: 'John' });
      const jane = await collection.findOne({ _id: john!.friendId });

      // Prints 'Jane 016b1cac-14ce-660e-8974-026c927b9b91 6'
      // console.log(jane?.name, jane?._id.toString(), jane?._id.version);

      assert.ok(john?.friendId instanceof UUID);
      assert.strictEqual(john?.friendId.toString(), '016b1cac-14ce-660e-8974-026c927b9b91');
      assert.strictEqual(john?.friendId.version, 6);

      assert.ok(john?._id instanceof UUID);
      assert.strictEqual(jane?.name, 'Jane');
      assert.strictEqual(jane?._id?.toString(), '016b1cac-14ce-660e-8974-026c927b9b91');

      assert.ok(jane?._id instanceof UUID);
      assert.ok(jane._id.equals(john?.friendId));

      const countedDocuments = await collection.countDocuments({}, 1000);
      assert.strictEqual(countedDocuments, 4);
    });

    it('works for finding a document', async () => {
      const client = new DataAPIClient(token);
      const db = client.db(endpoint, { namespace: DEFAULT_NAMESPACE });
      const collection = db.collection(DEFAULT_COLLECTION_NAME);

      // Insert some documents
      await collection.insertMany([
        { name: 'John', age: 30, $vector: [1, 1, 1, 1, 1] },
        { name: 'Jane', age: 25, },
        { name: 'Dave', age: 40, },
      ]);

      // Unpredictably prints one of their names
      const unpredictable = await collection.findOne({});
      // console.log(unpredictable?.name);
      assert.strictEqual(typeof unpredictable?.name, 'string')

      // Failed find by name (null)
      const failed = await collection.findOne({ name: 'Carrie' });
      // console.log(failed);
      assert.strictEqual(failed, null);

      // Find by $gt age (Dave)
      const dave = await collection.findOne({ age: { $gt: 30 } });
      // console.log(dave?.name);
      assert.strictEqual(dave?.name, 'Dave');

      // Find by sorting by age (Jane)
      const jane = await collection.findOne({}, { sort: { age: 1 } });
      // console.log(jane?.name);
      assert.strictEqual(jane?.name, 'Jane');

      // Find by vector similarity (John)
      const john = await collection.findOne({}, { vector: [1, 1, 1, 1, 1], includeSimilarity: true });
      // console.log(john?.name, john?.$similarity);
      assert.strictEqual(john?.name, 'John');
      assert.strictEqual(john?.$similarity, 1);
    });

    it('works for finding documents', async () => {
      const client = new DataAPIClient(token);
      const db = client.db(endpoint, { namespace: DEFAULT_NAMESPACE });
      const collection = db.collection(DEFAULT_COLLECTION_NAME);

      // Insert some documents
      await collection.insertMany([
        { name: 'John', age: 30, $vector: [1, 1, 1, 1, 1] },
        { name: 'Jane', age: 25, },
        { name: 'Dave', age: 40, },
      ]);

      // Gets all 3 in some order
      const unpredictable = await collection.find({}).toArray();
      // console.log(unpredictable);
      assert.strictEqual(unpredictable.length, 3);

      // Failed find by name ([])
      const matchless = await collection.find({ name: 'Carrie' }).toArray();
      // console.log(matchless);
      assert.strictEqual(matchless.length, 0);

      // Find by $gt age (John, Dave)
      const gtAgeCursor = collection.find({ age: { $gt: 25 } });
      // for await (const doc of gtAgeCursor) {
      //   console.log(doc.name);
      // }
      assert.deepStrictEqual((await gtAgeCursor.map(d => d.age).toArray()).sort(), [30, 40]);

      // Find by sorting by age (Jane, John, Dave)
      const sortedAgeCursor = collection.find({}, { sort: { age: 1 } });
      // sortedAgeCursor.forEach(console.log);
      assert.deepStrictEqual(await sortedAgeCursor.map(d => d.age).toArray(), [25, 30, 40]);

      // Find first by vector similarity (John)
      const john = await collection.find({}, { vector: [1, 1, 1, 1, 1], includeSimilarity: true }).next();
      // console.log(john?.name, john?.$similarity);
      assert.strictEqual(john?.name, 'John');
      assert.strictEqual(john?.$similarity, 1);
    });

    it('works for example sort operations', async () => {
      const client = new DataAPIClient(token);
      const db = client.db(endpoint, { namespace: DEFAULT_NAMESPACE });
      const collection = db.collection(DEFAULT_COLLECTION_NAME);

      // Insert some documents
      await collection.insertMany([
        { name: 'Jane', age: 25, $vector: [1.0, 1.0, 1.0, 1.0, 1.0] },
        { name: 'Dave', age: 40, $vector: [0.4, 0.5, 0.6, 0.7, 0.8] },
        { name: 'Jack', age: 40, $vector: [0.1, 0.9, 0.0, 0.5, 0.7] },
      ]);

      // Sort by age ascending, then by name descending (Jane, Jack, Dave)
      const sorted1 = await collection.find({}, { sort: { age: 1, name: -1 } }).toArray();
      // console.log(sorted1.map(d => d.name));
      assert.deepStrictEqual(sorted1.map(d => d.name), ['Jane', 'Jack', 'Dave']);

      // Sort by vector distance (Jane, Dave, Jack)
      const sorted2 = await collection.find({}, { vector: [1, 1, 1, 1, 1] }).toArray();
      // console.log(sorted2.map(d => d.name));
      assert.deepStrictEqual(sorted2.map(d => d.name), ['Jane', 'Dave', 'Jack']);
    });

    it('works for finding & updating a document', async () => {
      const client = new DataAPIClient(token);
      const db = client.db(endpoint, { namespace: DEFAULT_NAMESPACE });
      const collection = db.collection(DEFAULT_COLLECTION_NAME);

      // Insert a document
      await collection.insertOne({ 'Marco': 'Polo' });

      // Prints 'Mr.'
      const updated1 = await collection.findOneAndUpdate(
        { 'Marco': 'Polo' },
        { $set: { title: 'Mr.' } },
        { returnDocument: 'after' },
      );
      // console.log(updated1?.title);
      assert.strictEqual(updated1?.title, 'Mr.');
      assert.strictEqual(updated1?.Marco, 'Polo');

      // Prints { _id: ..., title: 'Mr.', rank: 3 }
      const updated2 = await collection.findOneAndUpdate(
        { title: 'Mr.' },
        { $inc: { rank: 3 } },
        { projection: { title: 1, rank: 1 }, returnDocument: 'after' },
      );
      // console.log(updated2);
      assert.strictEqual(updated2?.title, 'Mr.');
      assert.strictEqual(updated2?.rank, 3);
      assert.strictEqual(updated2?.Marco, undefined);

      // Prints null
      const updated3 = await collection.findOneAndUpdate(
        { name: 'Johnny' },
        { $set: { rank: 0 } },
        { returnDocument: 'after' },
      );
      // console.log(updated3);
      assert.strictEqual(updated3, null);

      // Prints { _id: ..., name: 'Johnny', rank: 0 }
      const updated4 = await collection.findOneAndUpdate(
        { name: 'Johnny' },
        { $set: { rank: 0 } },
        { upsert: true, returnDocument: 'after' },
      );
      // console.log(updated4);
      assert.strictEqual(updated4?.name, 'Johnny');
      assert.strictEqual(updated4?.rank, 0);
    });

    it('works for updating a document', async () => {
      const client = new DataAPIClient(token);
      const db = client.db(endpoint, { namespace: DEFAULT_NAMESPACE });
      const collection = db.collection(DEFAULT_COLLECTION_NAME);

      // Insert a document
      await collection.insertOne({ 'Marco': 'Polo' });

      // Prints 1
      const updated1 = await collection.updateOne(
        { 'Marco': 'Polo' },
        { $set: { title: 'Mr.' } },
      );
      // console.log(updated1?.modifiedCount);
      assert.strictEqual(updated1?.matchedCount, 1);
      assert.strictEqual(updated1?.modifiedCount, 1);
      assert.strictEqual(updated1?.upsertedCount, 0);

      // Prints 0, 0
      const updated2 = await collection.updateOne(
        { name: 'Johnny' },
        { $set: { rank: 0 } },
      );
      // console.log(updated2.matchedCount, updated2?.upsertedCount);
      assert.strictEqual(updated2?.matchedCount, 0);
      assert.strictEqual(updated2?.modifiedCount, 0);
      assert.strictEqual(updated2?.upsertedCount, 0);

      // Prints 0, 1
      const updated3 = await collection.updateOne(
        { name: 'Johnny' },
        { $set: { rank: 0 } },
        { upsert: true },
      );
      // console.log(updated3.matchedCount, updated3?.upsertedCount);
      assert.strictEqual(updated3?.matchedCount, 0);
      assert.strictEqual(updated3?.modifiedCount, 0);
      assert.strictEqual(updated3?.upsertedCount, 1);
    });
  });

  // describe('[vectorize] vectorize', () => {
  //   let db: Db;
  //
  //   before(async function () {
  //     assertTestsEnabled(this, 'VECTORIZE');
  //     [, db] = await initTestObjects(this);
  //   });
  //
  //   it('works for collection creation', async () => {
  //
  //   });
  // });
});
