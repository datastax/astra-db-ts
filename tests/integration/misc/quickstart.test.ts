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

import { assertTestsEnabled, initTestObjects, OTHER_NAMESPACE } from '@/tests/fixtures';
import { DataApiClient } from '@/src/client';
import { Db, ObjectId, UUID, VectorDoc } from '@/src/data-api';
import process from 'process';
import assert from 'assert';
import { DEFAULT_NAMESPACE } from '@/src/api';

describe('integration.misc.quickstart tests', () => {
  let db: Db;

  const endpoint = process.env.ASTRA_URI!;
  const idAndRegion = endpoint.split('.')[0].split('https://')[1].split('-');
  const id = idAndRegion.slice(0, 5).join('-');
  const region = idAndRegion.slice(5).join('-');

  before(async function () {
    [, db] = await initTestObjects(this);
  });

  describe('[long] quickstart', () => {
    before(async function () {
      assertTestsEnabled(this, 'LONG');
    });

    after(async function () {
      await db.dropCollection('vector_5_collection');
    });

    it('works', async () => {
      interface Idea extends VectorDoc {
        idea: string,
      }

      const client = new DataApiClient(process.env.APPLICATION_TOKEN!);
      const db = client.db(process.env.ASTRA_URI!);

      const collection = await db.createCollection<Idea>('vector_5_collection', { vector: { dimension: 5, metric: 'cosine' } });

      const ideas = [
        {
          idea: 'An AI quilt to help you sleep forever',
          $vector: [0.1, 0.15, 0.3, 0.12, 0.05],
        },
        {
          _id: new UUID('e7f1f3a0-7e3d-11eb-9439-0242ac130002'),
          idea: 'Vision Vector Frame—A deep learning display that controls your mood',
          $vector: [0.1, 0.05, 0.08, 0.3, 0.6],
        },
        {
          idea: 'A smartwatch that tells you what to eat based on your mood',
          $vector: [0.2, 0.3, 0.1, 0.4, 0.15],
        },
      ];
      await collection.insertMany(ideas);

      const sneakersIdea = {
        _id: new ObjectId('507f191e810c19729de860ea'),
        idea: 'ChatGPT-integrated sneakers that talk to you',
        $vector: [0.45, 0.09, 0.01, 0.2, 0.11],
      }
      await collection.insertOne(sneakersIdea);

      await collection.updateOne(
        { _id: sneakersIdea._id },
        { $set: { idea: 'Gemini-integrated sneakers that talk to you' } },
      );

      const cursor = collection.find({}, {
        vector: [0.1, 0.15, 0.3, 0.12, 0.05],
        includeSimilarity: true,
        limit: 2,
      });

      for await (const doc of cursor) {
        // An AI quilt to help you sleep forever: 1
        // A smartwatch that tells you what to eat based on your mood: 0.85490346
        assert.ok([1, 0.85490346].includes(doc.$similarity));
        assert.ok([ideas[0].idea, ideas[2].idea].includes(doc.idea));
      }
    });
  });

  describe('admin-quickstart', () => {
    it('works', async () => {
      const client = new DataApiClient(process.env.APPLICATION_TOKEN!);
      const admin = client.admin();

      const databases = await admin.listDatabases();
      const dbInfo = databases.find(db => db.id === id)!;
      assert.ok(dbInfo.info.name);
      assert.strictEqual(dbInfo.id, id);
      assert.strictEqual(dbInfo.info.region, region);

      const dbAdmin = admin.dbAdmin(dbInfo.id, dbInfo.info.region);
      const namespaces = await dbAdmin.listNamespaces();
      assert.ok(namespaces.includes(DEFAULT_NAMESPACE));
      assert.ok(namespaces.includes(OTHER_NAMESPACE));
    });
  });

  describe('[long] ids-quickstart', () => {
    before(async function () {
      assertTestsEnabled(this, 'LONG');
    });

    after(async function () {
      await db.dropCollection('my_collection');
    });

    it('works', async () => {
      interface Person {
        _id: ObjectId | UUID,
        name: string,
        friendId?: string,
      }

      const client = new DataApiClient(process.env.APPLICATION_TOKEN!);
      const db = client.db(process.env.ASTRA_URI!);

      const collection = await db.createCollection<Person>('my_collection', { defaultId: { type: 'uuidv7' } });

      await collection.insertOne({ _id: new ObjectId("65fd9b52d7fabba03349d013"), name: 'John' });

      await collection.insertOne({ name: 'Jane' });

      const friendId = UUID.v4();

      await collection.insertOne({ name: 'Alice', _id: friendId });

      await collection.updateOne(
        { name: 'Jane' },
        { $set: { friendId: friendId.toString() } },
      );

      const jane = await collection.findOne({ name: 'Jane' });
      assert.strictEqual(jane?.name, 'Jane');
      assert.ok(friendId.equals(jane?.friendId));
    });
  });

  describe('portal-quickstart', () => {
    it('works', async () => {
      const client = new DataApiClient(process.env.APPLICATION_TOKEN!);
      const db = client.db(process.env.ASTRA_URI!, { namespace: OTHER_NAMESPACE });
      assert.ok(Array.isArray(await db.listCollections()));
    });
  });
});
