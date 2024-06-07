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
import { Db } from '@/src/data-api';
import { assertTestsEnabled, initTestObjects } from '@/tests/fixtures';
import * as fs from 'fs';
import { fetch } from 'fetch-h2';
import { DEFAULT_DATA_API_AUTH_HEADER, DEFAULT_DATA_API_PATH } from '@/src/api';
import { after } from 'mocha';

interface VectorizeTest {
  provider: string,
  modelName: string,
  header?: string,
  providerKey?: string,
  authType: string,
  parameters: Record<string, unknown> | undefined,
}

describe('integration.data-api.vectorize', () => {
  let db: Db;

  before(async function () {
    assertTestsEnabled(this, 'VECTORIZE', 'LONG');

    [, db] = await initTestObjects(this);

    const tests: VectorizeTest[] = await initVectorTests().catch((e) => {
      console.error('Failed to initialize vectorize tests', e);
      return [];
    });

    describe('[vectorize] [long] generated tests', () => {
      const names = tests.map((test) => `${test.provider}_${test.modelName.replace(/\W/g, '')}_${test.authType}`);

      before(async () => {
        for (const name of names) {
          try { await db.dropCollection(name); } catch (_) { /* empty */ }
        }
      });

      tests.forEach((test, i) => {
        const name = names[i];

        describe('generated test', () => {
          createVectorizeProvidersTest(db, test, name)

          if (i === 0) {
            createVectorizeParamTests(db, test, name);
          }

          after(async () => {
            await db.dropCollection(name);
          });
        });
      });
    });
  });

  it('dummy test so before is executed', () => { assert.ok(true) });
});

async function initVectorTests() {
  const credentials = JSON.parse(fs.readFileSync('vectorize_credentials.json', 'utf8'));

  const embeddingProviders = await fetch(`${process.env.ASTRA_URI!}/${DEFAULT_DATA_API_PATH}`, {
    body: JSON.stringify({ findEmbeddingProviders: {} }),
    headers: {
      [DEFAULT_DATA_API_AUTH_HEADER]: process.env.APPLICATION_TOKEN,
    },
    method: 'POST',
  })
    .then(r => r.json())
    .then(r => r.status['embeddingProviders']);

  return Object.entries<any>(embeddingProviders)
    .flatMap(([provider, info]) => {
      if (!credentials[provider]) {
        console.warn(`No credentials found for provider ${provider}; skipping models `)
        return [];
      }

      return info['models'].map((model: any) => ({
        provider,
        modelName: model.name,
        header: info['supportedAuthentication']['HEADER'].enabled ? credentials[provider]['apiKey'] : undefined,
        providerKey: info['supportedAuthentication']['SHARED_SECRET'].enabled ? credentials[provider]['providerKey'] : undefined,
        none: info['supportedAuthentication']['NONE'].enabled,
        parameters: credentials[provider]['parameters']?.[model.name],
      }));
    })
    .flatMap((test) => {
      const tests: VectorizeTest[] = []

      for (const key of ['header', 'providerKey', 'none']) {
        if (test[key as keyof typeof test]) {
          tests.push({
            provider: test.provider,
            modelName: test.modelName,
            [key]: test[key as keyof typeof test],
            authType: key,
            parameters: test.parameters,
          });
        }
      }

      return tests;
    });
}

function createVectorizeParamTests(db: Db, test: VectorizeTest, name: string) {
  describe('[vectorize] [dev] $vectorize/vectorize params', () => {
    const collection = db.collection(name, {
      embeddingApiKey: test.header,
    });

    before(async function () {
      if (!await db.listCollections({ nameOnly: true }).then(cs => cs.some((c) => c === name))) {
        this.skip();
      }
    });

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
        await collection.findOneAndUpdate({}, {}, {
          sort: { name: 1 },
          vectorize: 'some text',
          returnDocument: 'before',
        });
      });
      await assert.rejects(async () => {
        await collection.replaceOne({}, {}, { sort: { name: 1 }, vectorize: 'some text' });
      });
      await assert.rejects(async () => {
        await collection.findOneAndReplace({}, {}, {
          sort: { name: 1 },
          vectorize: 'some text',
          returnDocument: 'before',
        });
      });
      await assert.rejects(async () => {
        await collection.deleteOne({}, { sort: { name: 1 }, vectorize: 'some text' });
      });
      await assert.rejects(async () => {
        await collection.findOneAndDelete({}, { sort: { name: 1 }, vectorize: 'some text' });
      });
    });
  });
}

function createVectorizeProvidersTest(db: Db, test: VectorizeTest, name: string) {
  it(`[vectorize] [dev] has a working lifecycle (${test.provider}/${test.modelName}) (${test.authType})`, async () => {
    const collection = await db.createCollection(name, {
      vector: {
        service: {
          provider: test.provider,
          modelName: test.modelName,
          authentication: {
            providerKey: test.providerKey,
          },
          parameters: test.parameters,
        },
      },
      embeddingApiKey: test.header,
    });

    const insertOneResult = await collection.insertOne({
      name: 'Alice',
      age: 30,
    }, {
      vectorize: 'Alice likes big red cars',
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
        'Cause maybe, you\'re gonna be the one that saves me... and after all, you\'re my wonderwall...',
        'The water bottle was small',
      ],
    });

    assert.ok(insertManyResult);
    assert.strictEqual(insertManyResult.insertedCount, 2);

    const findOneResult = await collection.findOne({}, {
      vectorize: 'Alice likes big red cars',
      includeSimilarity: true,
    });

    assert.ok(findOneResult);
    assert.strictEqual(findOneResult._id, insertOneResult.insertedId);
    assert.ok(findOneResult.$similarity > 0.8);

    const deleteResult = await collection.deleteOne({}, {
      vectorize: 'Alice likes big red cars',
    });

    assert.ok(deleteResult);
    assert.strictEqual(deleteResult.deletedCount, 1);

    const findResult = await collection.find({}, {
      vectorize: 'Cause maybe, you\'re gonna be the one that saves me... and after all, you\'re my wonderwall...',
      includeSimilarity: true,
    }).toArray();

    assert.strictEqual(findResult.length, 2);
  }).timeout(90000);
}
