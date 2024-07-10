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
import { Db } from '@/src/data-api';
import { assertTestsEnabled, ENVIRONMENT, initTestObjects } from '@/tests/fixtures';
import * as fs from 'fs';
import { after } from 'mocha';
import {
  EmbeddingProviderInfo,
  EmbeddingProviderModelInfo,
} from '@/src/devops/types/db-admin/find-embedding-providers';

interface VectorizeTestSpec {
  [providerName: string]: {
    apiKey?: string,
    providerKey?: string,
    dimension?: {
      [modelNameRegex: string]: number,
    },
    parameters?: {
      [modelNameRegex: string]: Record<string, string>
    },
  }
}

describe('[astra] integration.data-api.vectorize', () => {
  let db: Db;

  before(async function () {
    assertTestsEnabled(this, 'VECTORIZE', 'LONG', 'ASTRA');

    [, db] = await initTestObjects();

    const tests: VectorizeTest[] = await initVectorTests(db).catch((e: unknown) => {
      console.error('Failed to initialize vectorize tests', e);
      return [];
    });

    describe('[vectorize] [long] generated tests', () => {
      const names = tests.map((test) => Buffer.from(test.testName).toString('base64').replace(/\W/g, '').slice(0, 48));

      before(async () => {
        for (const name of names) {
          try { await db.dropCollection(name); } catch (_) { /* empty */ }
        }
      });

      tests.forEach((test, i) => {
        const name = names[i];

        describe('generated test', () => {
          createVectorizeProvidersTest(db, test, name);

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

const initVectorTests = async (db: Db) => {
  const spec = JSON.parse(fs.readFileSync('vectorize_credentials.json', 'utf8')) as VectorizeTestSpec;

  const { embeddingProviders } = await (
    (ENVIRONMENT === 'astra')
      ? db.admin({ environment: ENVIRONMENT })
      : db.admin({ environment: ENVIRONMENT })
  ).findEmbeddingProviders();

  const whitelist = RegExp(process.env.VECTORIZE_WHITELIST ?? '.*');

  return Object.entries(embeddingProviders)
    .flatMap(branchOnModel(spec))
    .filter(t => {
      console.log(t.testName);
      return whitelist.test(t.testName);
    });
};

interface ModelBranch {
  providerName: string,
  modelName: string,
  testName: string,
}

const branchOnModel = (fullSpec: VectorizeTestSpec) => ([providerName, providerInfo]: [string, EmbeddingProviderInfo]): AuthBranch[] => {
  const spec = fullSpec[providerName];

  if (!spec) {
    console.warn(`No credentials found for provider ${providerName}; skipping models `)
    return [];
  }

  const modelBranches = providerInfo.models.map((model) => ({
    providerName: providerName,
    modelName: model.name,
    testName: `${providerName}@${model.name}`,
  }));

  return modelBranches.flatMap(addParameters(spec, providerInfo));
}

interface WithParams extends ModelBranch {
  parameters?: Record<string, string>,
}

const addParameters = (spec: VectorizeTestSpec[string], providerInfo: EmbeddingProviderInfo) => (test: ModelBranch): AuthBranch[] => {
  const params = spec.parameters;
  const matchingParam = Object.keys(params ?? {}).find((regex) => RegExp(regex).test(test.modelName))!;

  if (params && !matchingParam) {
    throw new Error(`can not find matching param for ${test.testName}`)
  }

  const withParams = [{
    ...test,
    parameters: spec.parameters?.[matchingParam],
  }];

  return withParams.flatMap(branchOnAuth(spec, providerInfo));
}

interface AuthBranch extends WithParams {
  authType: 'header' | 'providerKey' | 'none',
  providerKey?: string,
  header?: string,
}

const branchOnAuth = (spec: VectorizeTestSpec[string], providerInfo: EmbeddingProviderInfo) => (test: WithParams): AuthBranch[] => {
  const auth = providerInfo['supportedAuthentication'];
  const tests: AuthBranch[] = []

  if (auth['HEADER'].enabled && spec.apiKey) {
    tests.push({ ...test, authType: 'header', header: spec.apiKey, testName: `${test.testName}@header` });
  }

  if (auth['SHARED_SECRET'].enabled && spec.providerKey) {
    tests.push({ ...test, authType: 'providerKey', providerKey: spec.providerKey, testName: `${test.testName}@providerKey` });
  }

  if (auth['NONE'].enabled) {
    tests.push({ ...test, authType: 'none', testName: `${test.testName}@none` });
  }

  const modelInfo = providerInfo.models.find((m) => m.name === test.modelName)!;

  return tests.flatMap(branchOnDimension(spec, modelInfo));
}

interface DimensionBranch extends AuthBranch {
  dimension?: number,
}

const branchOnDimension = (spec: VectorizeTestSpec[string], modelInfo: EmbeddingProviderModelInfo) => (test: AuthBranch): DimensionBranch[] => {
  const vectorDimParam = modelInfo.parameters.find((p) => p.name === 'vectorDimension');
  const defaultDim = Number(vectorDimParam?.defaultValue);

  if (vectorDimParam && !defaultDim) {
    const matchingDim = Object.keys(spec.dimension ?? {}).find((regex) => RegExp(regex).test(test.modelName))!;

    if (!spec.dimension || !matchingDim) {
      throw new Error(`No matching "dimension" parameter found in spec for ${test.testName}}`);
    }

    return [{ ...test, dimension: spec.dimension[matchingDim], testName: `${test.testName}@specified` }];
  }

  if (vectorDimParam && defaultDim) {
    return [{ ...test, testName: `${test.testName}@default` }, { ...test, dimension: defaultDim, testName: `${test.testName}/${defaultDim}` }];
  }

  return [{ ...test, testName: `${test.testName}@default` }];
}

type VectorizeTest = DimensionBranch;

const createVectorizeProvidersTest = (db: Db, test: VectorizeTest, name: string) => {
  it(`[vectorize] [dev] has a working lifecycle (${test.testName})`, async () => {
    const collection = await db.createCollection(name, {
      vector: {
        dimension: test.dimension,
        service: {
          provider: test.providerName,
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
  });
};

const createVectorizeParamTests = function (db: Db, test: VectorizeTest, name: string) {
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
      await collection.deleteMany({});
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
      assert.throws(() => {
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
};
