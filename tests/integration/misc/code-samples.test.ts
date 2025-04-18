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
import { ObjectId, UUID } from '@/src/documents/index.js';
import { describe, it, parallel } from '@/tests/testlib/index.js';

describe('integration.misc.code-samples', { truncate: 'colls:before' }, ({ collection }) => {
  parallel('documents', () => {
    it('works for dates', async (key) => {
      await collection.insertOne({ dateOfBirth: new Date(1394104654000), key });
      await collection.insertOne({ dateOfBirth: new Date('1863-05-28'), key });

      await collection.updateOne(
        {
          dateOfBirth: new Date('1863-05-28'),
          key,
        },
        {
          $set: { message: 'Happy Birthday!' },
          $currentDate: { lastModified: true },
        },
      );

      // Will print _around_ `new Date()`
      const found = await collection.findOne({ dateOfBirth: { $lt: new Date('1900-01-01') }, key });
      // console.log(found?.lastModified);

      assert.strictEqual(found?.message, 'Happy Birthday!');
      assert.ok(found.lastModified instanceof Date);
      assert.strictEqual(found.dateOfBirth.toISOString(), new Date('1863-05-28').toISOString());

      const countedDocuments = await collection.countDocuments({ key }, 1000);
      assert.strictEqual(countedDocuments, 2);
    });

    it('works for document IDs', async (key) => {
      await collection.insertOne({ name: 'John', _id: UUID.v4(), key });
      await collection.insertOne({ name: 'Jane', _id: new UUID('016b1cac-14ce-660e-8974-026c927b9b91'), key });

      await collection.insertOne({ name: 'Dan', _id: new ObjectId(), key });
      await collection.insertOne({ name: 'Tim', _id: new ObjectId('65fd9b52d7fabba03349d013'), key });

      await collection.updateOne(
        { name: 'John', key },
        { $set: { friendId: new UUID('016b1cac-14ce-660e-8974-026c927b9b91') } },
      );

      const john = await collection.findOne({ name: 'John', key });
      const jane = await collection.findOne({ _id: john?.friendId, key });

      // Prints 'Jane 016b1cac-14ce-660e-8974-026c927b9b91 6'
      // console.log(jane?.name, jane?._id.toString(), jane?._id.version);

      assert.ok(john?._id instanceof UUID);
      assert.ok(jane?._id instanceof UUID);

      assert.strictEqual(jane.name, 'Jane');
      assert.strictEqual(jane._id.toString(), '016b1cac-14ce-660e-8974-026c927b9b91');

      assert.ok(john.friendId instanceof UUID);
      assert.ok(jane._id.equals(john.friendId));

      const countedDocuments = await collection.countDocuments({ key }, 1000);
      assert.strictEqual(countedDocuments, 4);
    });

    it('works for finding a document', async (key) => {
      // Insert some documents
      await collection.insertMany([
        { name: 'John', age: 30, $vector: [1, 1, 1, 1, 1], key },
        { name: 'Jane', age: 25, key },
        { name: 'Dave', age: 40, key },
      ]);

      // Unpredictably prints one of their names
      const unpredictable = await collection.findOne({ key });
      // console.log(unpredictable?.name);
      assert.strictEqual(typeof unpredictable?.name, 'string');

      // Failed find by name (null)
      const failed = await collection.findOne({ name: 'Carrie', key });
      // console.log(failed);
      assert.strictEqual(failed, null);

      // Find by $gt age (Dave)
      const dave = await collection.findOne({ age: { $gt: 30 }, key });
      // console.log(dave?.name);
      assert.strictEqual(dave?.name, 'Dave');

      // Find by sorting by age (Jane)
      const jane = await collection.findOne({ key }, { sort: { age: 1 } });
      // console.log(jane?.name);
      assert.strictEqual(jane?.name, 'Jane');

      // Find by vector similarity (John)
      const john = await collection.findOne({ key }, { sort: { $vector: [1, 1, 1, 1, 1] }, includeSimilarity: true });
      // console.log(john?.name, john?.$similarity);
      assert.strictEqual(john?.name, 'John');
      assert.strictEqual(john.$similarity, 1);
    });

    it('works for finding documents', async (key) => {
      // Insert some documents
      await collection.insertMany([
        { name: 'John', age: 30, $vector: [1, 1, 1, 1, 1], key },
        { name: 'Jane', age: 25, key },
        { name: 'Dave', age: 40, key },
      ]);

      // Gets all 3 in some order
      const unpredictable = await collection.find({ key }).toArray();
      // console.log(unpredictable);
      assert.strictEqual(unpredictable.length, 3);

      // Failed find by name ([])
      const matchless = await collection.find({ name: 'Carrie', key }).toArray();
      // console.log(matchless);
      assert.strictEqual(matchless.length, 0);

      // Find by $gt age (John, Dave)
      const gtAgeCursor = collection.find({ age: { $gt: 25 }, key });
      // for await (const doc of gtAgeCursor) {
      //   console.log(doc.name);
      // }
      assert.deepStrictEqual((await gtAgeCursor.map(d => d.age).toArray()).sort(), [30, 40]);

      // Find by sorting by age (Jane, John, Dave)
      const sortedAgeCursor = collection.find({ key }, { sort: { age: 1 } });
      // sortedAgeCursor.forEach(console.log);
      assert.deepStrictEqual(await sortedAgeCursor.map(d => d.age).toArray(), [25, 30, 40]);

      // Find first by vector similarity (John)
      const john = await collection.find({ key }, { sort: { $vector: [1, 1, 1, 1, 1] }, includeSimilarity: true }).next();
      // console.log(john?.name, john?.$similarity);
      assert.strictEqual(john?.name, 'John');
      assert.strictEqual(john.$similarity, 1);
    });

    it('works for example sort operations', async (key) => {
      // Insert some documents
      await collection.insertMany([
        { name: 'Jane', age: 25, $vector: [1.0, +1.0, 1.0, 1.0, 1.0], key },
        { name: 'Dave', age: 40, $vector: [0.4, -0.4, 0.6, 0.7, 0.8], key },
        { name: 'Jack', age: 40, $vector: [0.1, -0.6, 0.0, 0.5, 0.7], key },
      ]);

      // Sort by age ascending, then by name descending (Jane, Jack, Dave)
      const sorted1 = await collection.find({ key }, { sort: { age: 1, name: -1 } }).toArray();
      // console.log(sorted1.map(d => d.name));
      assert.deepStrictEqual(sorted1.map(d => d.name), ['Jane', 'Jack', 'Dave']);

      // Sort by vector distance (Jane, Dave, Jack)
      const sorted2 = await collection.find({ key }, { sort: { $vector: [1, 1, 1, 1, 1] } }).toArray();
      // console.log(sorted2.map(d => d.name));
      assert.deepStrictEqual(sorted2.map(d => d.name), ['Jane', 'Dave', 'Jack']);
    });

    it('works for finding & updating a document', async (key) => {
      // Insert a document
      await collection.insertOne({ 'Marco': 'Polo', key });

      // Prints 'Mr.'
      const updated1 = await collection.findOneAndUpdate(
        { 'Marco': 'Polo', key },
        { $set: { title: 'Mr.' } },
        { returnDocument: 'after' },
      );
      // console.log(updated1?.title);
      assert.strictEqual(updated1?.title, 'Mr.');
      assert.strictEqual(updated1.Marco, 'Polo');

      // Prints { _id: ..., title: 'Mr.', rank: 3 }
      const updated2 = await collection.findOneAndUpdate(
        { title: 'Mr.', key },
        { $inc: { rank: 3 } },
        { projection: { title: 1, rank: 1 }, returnDocument: 'after' },
      );
      // console.log(updated2);
      assert.strictEqual(updated2?.title, 'Mr.');
      assert.strictEqual(updated2.rank, 3);
      assert.strictEqual(updated2.Marco, undefined);

      // Prints null
      const updated3 = await collection.findOneAndUpdate(
        { name: 'Johnny', key },
        { $set: { rank: 0 } },
        { returnDocument: 'after' },
      );
      // console.log(updated3);
      assert.strictEqual(updated3, null);

      // Prints { _id: ..., name: 'Johnny', rank: 0 }
      const updated4 = await collection.findOneAndUpdate(
        { name: 'Johnny', key },
        { $set: { rank: 0 } },
        { upsert: true, returnDocument: 'after' },
      );
      // console.log(updated4);
      assert.strictEqual(updated4?.name, 'Johnny');
      assert.strictEqual(updated4.rank, 0);
    });

    it('works for updating a document', async (key) => {
      // Insert a document
      await collection.insertOne({ 'Marco': 'Polo', key });

      // Prints 1
      const updated1 = await collection.updateOne(
        { 'Marco': 'Polo', key },
        { $set: { title: 'Mr.' } },
      );
      assert.strictEqual(updated1.matchedCount, 1);
      assert.strictEqual(updated1.modifiedCount, 1);
      assert.strictEqual(updated1.upsertedCount, 0);

      // Prints 0, 0
      const updated2 = await collection.updateOne(
        { name: 'Johnny', key },
        { $set: { rank: 0 } },
      );
      assert.strictEqual(updated2.matchedCount, 0);
      assert.strictEqual(updated2.modifiedCount, 0);
      assert.strictEqual(updated2.upsertedCount, 0);

      // Prints 0, 1
      const updated3 = await collection.updateOne(
        { name: 'Johnny', key },
        { $set: { rank: 0 } },
        { upsert: true },
      );
      assert.strictEqual(updated3.matchedCount, 0);
      assert.strictEqual(updated3.modifiedCount, 0);
      assert.strictEqual(updated3.upsertedCount, 1);
    });
  });
});
