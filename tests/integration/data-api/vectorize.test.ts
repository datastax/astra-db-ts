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
import { Collection, Db } from '@/src/data-api';
import { assertTestsEnabled, initTestObjects } from '@/tests/fixtures';
import process from 'process';
import { after } from 'mocha';

const EPHEMERAL_VECTORIZE_COLL_NAME = 'vectorize_coll';

describe('integration.data-api.vectorize', () => {
  let db: Db;
  let collection: Collection;

  before(async function () {
    [, db] = await initTestObjects(this);

    await db.dropCollection(EPHEMERAL_VECTORIZE_COLL_NAME);

    const { ASTRA_EMBEDDING_API_KEY, ASTRA_EMBEDDING_PROVIDER, ASTRA_EMBEDDING_MODEL } = process.env;

    if (!ASTRA_EMBEDDING_PROVIDER || !ASTRA_EMBEDDING_MODEL) {
      throw new Error('Please set ASTRA_EMBEDDING_API_KEY, ASTRA_EMBEDDING_PROVIDER, and ASTRA_EMBEDDING_MODEL to run this test')
    }

    const vectorOptions = {
      service: {
        modelName: ASTRA_EMBEDDING_MODEL,
        provider: ASTRA_EMBEDDING_PROVIDER,
      },
    };

    collection = await db.createCollection(EPHEMERAL_VECTORIZE_COLL_NAME, {
      embeddingApiKey: ASTRA_EMBEDDING_API_KEY,
      vector: vectorOptions,
    });
  });

  after(async function () {
    await db.dropCollection(EPHEMERAL_VECTORIZE_COLL_NAME);
  });

  it('[vectorize] [dev] has a working lifecycle', async function () {
    assertTestsEnabled(this, 'VECTORIZE', 'DEV');

    const insertOneResult = await collection.insertOne({
      name: 'Alice',
      age: 30,
    }, {
      vectorize: "Alice likes big red cars",
    });

    assert.ok(insertOneResult);

    const insertManyResult = await collection.insertMany([
      {
        name: 'Bob',
        age: 40,
      },
      {
        name: 'Charlie',
        age: 50,
      },
    ], {
      vectorize: [
        "Bob likes small compact trucks",
        "Charlie hates planes",
      ],
    });

    assert.ok(insertManyResult);
    assert.strictEqual(insertManyResult.insertedCount, 2);

    const findOneResult = await collection.findOne({}, {
      vectorize: "Alice likes big red cars",
      includeSimilarity: true,
    });

    assert.ok(findOneResult);
    assert.strictEqual(findOneResult._id, insertOneResult.insertedId);
    assert.ok(findOneResult.$similarity > 0.8);

    const deleteResult = await collection.deleteOne({}, {
      vectorize: "Alice likes big red cars",
    });

    assert.ok(deleteResult);
    assert.strictEqual(deleteResult.deletedCount, 1);

    const findResult = await collection.find({}, {
      vectorize: "Bob likes small compact trucks",
      includeSimilarity: true,
    }).toArray();

    assert.strictEqual(findResult.length, 2);
    assert.deepStrictEqual(findResult.map(r => r._id), insertManyResult.insertedIds);
  }).timeout(90000);

  describe('[vectorize] [dev] $vectorize/vectorize params', () => {
    beforeEach(async () => {
      await collection.deleteAll();
    });

    it('should override $vectorize if both are set in insertOne', async () => {
      await collection.insertOne({
        _id: '1',
        $vectorize: 'The grass was as green as it always was that sinister day',
      }, {
        vectorize: 'The blackbirds sang their song as they always did that black-letter day',
      })

      const result = await collection.findOne({ _id: '1' }, { projection: { '*': 1 } });
      assert.strictEqual(result?.$vectorize, 'The blackbirds sang their song as they always did that black-letter day');
    });

    it('should override $vectorize if both are set in insertMany', async () => {
      await collection.insertMany([
        {
          _id: '1',
          $vectorize: 'The grass was as green as it always was that sinister day',
        },
        {
          _id: '2',
          $vectorize: 'The grass was as green as it always was that sinister day',
        },
      ], {
        vectorize: [
          'The blackbirds sang their song as they always did that black-letter day',
          null,
        ],
      });

      const result1 = await collection.findOne({ _id: '1' }, { projection: { '*': 1 } });
      assert.strictEqual(result1?.$vectorize, 'The blackbirds sang their song as they always did that black-letter day');
      const result2 = await collection.findOne({ _id: '2' }, { projection: { '*': 1 } });
      assert.strictEqual(result2?.$vectorize, 'The grass was as green as it always was that sinister day');
    });

    it('should throw an error if vectorize and sort are both set', async () => {
      await assert.rejects(async () => {
        await collection.findOne({}, { sort: { name: 1 }, vectorize: 'some text' });
      });
      await assert.rejects(async () => {
        collection.find({}, { sort: { name: 1 }, vectorize: 'some text' });
      });
      await assert.rejects(async () => {
        await collection.updateOne({}, {}, { sort: { name: 1 }, vectorize: 'some text' });
      });
      await assert.rejects(async () => {
        await collection.findOneAndUpdate({}, {}, { sort: { name: 1 }, vectorize: 'some text', returnDocument: 'before' });
      });
      await assert.rejects(async () => {
        await collection.replaceOne({}, {}, { sort: { name: 1 }, vectorize: 'some text' });
      });
      await assert.rejects(async () => {
        await collection.findOneAndReplace({}, {}, { sort: { name: 1 }, vectorize: 'some text', returnDocument: 'before' });
      });
      await assert.rejects(async () => {
        await collection.deleteOne({}, { sort: { name: 1 }, vectorize: 'some text' });
      });
      await assert.rejects(async () => {
        await collection.findOneAndDelete({}, { sort: { name: 1 }, vectorize: 'some text' });
      });
    });
  });
});
