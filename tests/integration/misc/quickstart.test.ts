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

import { DataAPIClient } from '@/src/client/index.js';
import { ObjectId, UUID } from '@/src/documents/index.js';
import { DEFAULT_KEYSPACE } from '@/src/lib/api/index.js';
import { Cfg, it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';

parallel('integration.misc.quickstart', { drop: 'colls:after' }, () => {
  it('(LONG) works for the quickstart', async () => {
    interface Idea {
      idea: string,
      $vector?: number[],
    }

    const client = new DataAPIClient(Cfg.DbToken, { environment: Cfg.DbEnvironment });
    const db = client.db(Cfg.DbUrl, { keyspace: DEFAULT_KEYSPACE });

    const collection = await db.createCollection<Idea>('vector_5_collection', { vector: { dimension: 5, metric: 'cosine' }, timeout: 60000 });

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
    };
    await collection.insertOne(sneakersIdea);

    await collection.updateOne(
      { _id: sneakersIdea._id },
      { $set: { idea: 'Gemini-integrated sneakers that talk to you' } },
    );

    const cursor = collection.find({}, {
      sort: { $vector: [0.1, 0.15, 0.3, 0.12, 0.05] },
      includeSimilarity: true,
      limit: 2,
    });

    for await (const doc of cursor) {
      // An AI quilt to help you sleep forever: 1
      // A smartwatch that tells you what to eat based on your mood: 0.85490346
      assert.ok([1, 0.85490346].includes(doc.$similarity ?? 0));
      assert.ok([ideas[0].idea, ideas[2].idea].includes(doc.idea));
    }

    await client.close();
  });

  it('(NOT-DEV) (ASTRA) works for the admin-quickstart', async () => {
    const client = new DataAPIClient(Cfg.DbToken);
    const admin = client.admin();

    const idAndRegion = Cfg.DbUrl.split('.')[0].split('https://')[1].split('-');
    const id = idAndRegion.slice(0, 5).join('-');
    const region = idAndRegion.slice(5).join('-');

    const databases = await admin.listDatabases();
    const dbInfo = databases.find(db => db.id === id);
    assert.ok(dbInfo?.name);
    assert.strictEqual(dbInfo.id, id);
    assert.strictEqual(dbInfo.regions.length, 1);
    assert.strictEqual(dbInfo.regions[0].name, region);
    assert.strictEqual(dbInfo.regions[0].apiEndpoint, Cfg.DbUrl);
    assert.ok(dbInfo.regions[0].createdAt as unknown instanceof Date);

    const dbAdmin = admin.dbAdmin(dbInfo.id, dbInfo.regions[0].name);
    const keyspaces = await dbAdmin.listKeyspaces();
    assert.ok(keyspaces.includes(DEFAULT_KEYSPACE));
    assert.ok(keyspaces.includes(Cfg.OtherKeyspace));

    await client.close();
  });

  it('(LONG) works for the ids quickstart', async () => {
    interface Person {
      _id: ObjectId | UUID,
      name: string,
      friendId?: string,
    }

    const client = new DataAPIClient(Cfg.DbToken, { environment: Cfg.DbEnvironment });
    const db = client.db(Cfg.DbUrl, { keyspace: DEFAULT_KEYSPACE });

    const collection = await db.createCollection<Person>('my_collection', { defaultId: { type: 'uuidv7' }, timeout: 60000 });

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
    assert.ok(friendId.equals(jane.friendId));

    await client.close();
  });

  it('works for the portal quickstart', async () => {
    const client = new DataAPIClient(Cfg.DbToken, { environment: Cfg.DbEnvironment });
    const db = client.db(Cfg.DbUrl, { keyspace: Cfg.OtherKeyspace });
    assert.ok(Array.isArray(await db.listCollections()));
  });
});
