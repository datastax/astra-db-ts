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
import {
  AWSEmbeddingHeadersProvider, Collection,
  Db,
  EmbeddingAPIKeyHeaderProvider,
  EmbeddingHeadersProvider,
  UUID,
} from '@/src/data-api';
import * as fs from 'fs';
import {
  EmbeddingProviderInfo,
  EmbeddingProviderModelInfo,
} from '@/src/devops/types/db-admin/find-embedding-providers';
import { describe, dynamic, ENVIRONMENT, it, parallel } from '@/tests/testlib';
import { DbAdmin } from '@/src/devops';
import * as crypto from 'node:crypto';
import { negate } from '@/tests/testlib/utils';

interface VectorizeTestSpec {
  [providerName: string]: {
    headers?: {
      [header: `x-${string}`]: string,
    }
    sharedSecret?: {
      providerKey?: string,
    }
    dimension?: {
      [modelNameRegex: string]: number,
    },
    parameters?: {
      [modelNameRegex: string]: Record<string, string>
    },
    loadingTime: number,
  }
}

interface TestCollSupplier {
  test: VectorizeTest,
  getColl: () => Promise<Collection>,
}

interface TestCollsSupplier {
  testName: string,
  collName: string,
  tests: TestCollSupplier[];
}

dynamic('[VECTORIZE] [LONG] integration.data-api.vectorize', async ({ db, dbAdmin }) => {
  const tests: VectorizeTest[] = await initVectorTests(dbAdmin).catch((e: unknown) => {
    console.error('Failed to initialize vectorize tests', e);
    return [];
  });

  if (tests.length === 0) {
    return;
  }

  const groups = groupTests(db, tests);

  describe('[VECTORIZE] generated test', { dropEphemeral: 'after' }, () => {
    createVectorizeProvidersTest(groups[0]);
    createVectorizeParamTests(db, groups[0].collName, groups[0].tests.at(-1)?.test.header);
  });

  groups.shift();

  for (let i = 0, n = groups.length; i < n; i += 7) {
    parallel('[VECTORIZE] generated tests', { dropEphemeral: 'after' }, () => {
      for (let j = 0; j < 7 && i + j < n; j++) {
        createVectorizeProvidersTest(groups[i + j]);
      }
    });
  }
});

const whitelistImplFor = (whitelist: string) => {
  if (whitelist.startsWith('$limit:')) {
    const limit = +whitelist.split('$limit:')[1];

    return (_: VectorizeTest, index: number) => {
      return index < limit;
    };
  }

  if (whitelist.startsWith('$provider-limit:') || whitelist.startsWith('$model-limit:')) {
    const limit = +whitelist.split(':')[1];
    const seen = new Map<string, number>();

    return (test: VectorizeTest) => {
      const key = test.providerName + (whitelist.startsWith('$model') ? test.modelName : '');

      const timesSeen = (seen.get(key) ?? 0) + 1;
      seen.set(key, timesSeen);

      return timesSeen < limit;
    }
  }

  const regex = RegExp(whitelist);

  return (test: VectorizeTest) => {
    return regex.test(test.testName);
  }
}

function groupTests(db: Db, modelBranches: VectorizeTest[]): TestCollsSupplier[] {
  const groups: Record<string, VectorizeTest[]> = {};

  for (const branch of modelBranches) {
    const authType = (branch.authType === 'none')
      ? 'none'
      : 'header+kms';

    const key = `${branch.providerName}@${branch.modelName}@${authType}`;

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(branch);
  }

  return Object.values(groups).map((tests) => {
    if (tests[0].authType === 'none') {
      const test = tests[0];
      const collectionName = mkCollectionName(test.testName);

      const testCreation = () => db.createCollection(collectionName, {
        vector: {
          dimension: test.dimension,
          service: {
            provider: test.providerName,
            modelName: test.modelName,
            parameters: test.parameters,
          },
        },
      });

      return {
        testName: test.testName,
        collName: collectionName,
        tests: [{ test: test, getColl: testCreation }],
      };
    } else {
      const kmsTest = tests.find(t => t.authType === 'providerKey');
      const headerTest = tests.find(t => t.authType === 'header');

      const combinedTestName = (kmsTest ?? headerTest)!.testName
        .replace('@header', '@header+kms')
        .replace('@providerKey', '@header+kms')

      const collectionName = mkCollectionName(combinedTestName);

      const createCollection = (test: VectorizeTest) => () => db.createCollection(collectionName, {
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

      const useCollection = (test: VectorizeTest) => async () => db.collection(collectionName, {
        embeddingApiKey: test.header,
      });

      const kmsCreation: TestCollSupplier = kmsTest ? ({
        test: kmsTest,
        getColl: createCollection(kmsTest),
      }) : null!;

      const headerCreation: TestCollSupplier = headerTest ? ({
        test: headerTest,
        getColl: kmsTest ? useCollection(headerTest) : createCollection(headerTest),
      }) : null!;

      return {
        testName: combinedTestName,
        collName: collectionName,
        tests: [kmsCreation, headerCreation].filter(Boolean),
      };
    }
  });
}

const mkCollectionName = (testName: string): string => {
  return testName[0] + crypto
    .createHash('md5')
    .update(testName)
    .digest('hex');
}

const initVectorTests = async (dbAdmin: DbAdmin): Promise<VectorizeTest[]> => {
  const spec = JSON.parse(fs.readFileSync('vectorize_test_spec.json', 'utf8')) as VectorizeTestSpec;

  const { embeddingProviders } = await dbAdmin.findEmbeddingProviders();

  const whitelist = whitelistImplFor(process.env.CLIENT_VECTORIZE_WHITELIST ?? '.*');
  const invertWhitelist = !!process.env.CLIENT_VECTORIZE_WHITELIST_INVERT;

  const filter = (invertWhitelist)
    ? negate(whitelist)
    : whitelist;

  return Object.entries(embeddingProviders)
    .flatMap(branchOnModel(spec))
    .filter(filter)
};

interface ModelBranch {
  providerName: string,
  modelName: string,
  testName: string,
  loadingTime: number,
}

const branchOnModel = (fullSpec: VectorizeTestSpec) => ([providerName, providerInfo]: [string, EmbeddingProviderInfo]): VectorizeTest[] => {
  const spec = fullSpec[providerName];

  if (!spec) {
    console.warn(`No credentials found for provider ${providerName}; skipping models `)
    return [];
  }

  const modelBranches = providerInfo.models.map((model) => ({
    providerName: providerName,
    modelName: model.name,
    testName: `${providerName}@${model.name}`,
    loadingTime: spec.loadingTime ?? 0,
  }));

  return modelBranches.flatMap(addParameters(spec, providerInfo));
}

interface WithParams extends ModelBranch {
  parameters?: Record<string, string>,
}

const addParameters = (spec: VectorizeTestSpec[string], providerInfo: EmbeddingProviderInfo) => (test: ModelBranch): VectorizeTest[] => {
  const params = spec.parameters;
  const matchingParam = Object.keys(params ?? {}).find((regex) => RegExp(regex).test(test.modelName))!;

  if (params && !matchingParam) {
    throw new Error(`can not find matching param for ${test.testName}`);
  }

  const withParams = [{
    ...test,
    parameters: spec.parameters?.[matchingParam],
  }];

  return withParams.flatMap(branchOnAuth(spec, providerInfo));
}

interface AuthBranch extends WithParams {
  authType: 'header' | 'providerKey' | 'none',
  header?: EmbeddingHeadersProvider,
  providerKey?: string,
}

const branchOnAuth = (spec: VectorizeTestSpec[string], providerInfo: EmbeddingProviderInfo) => (test: WithParams): VectorizeTest[] => {
  const auth = providerInfo['supportedAuthentication'];
  const tests: AuthBranch[] = []

  const ehp = resolveHeaderProvider(spec);

  if (auth['HEADER']?.enabled && ehp) {
    tests.push({ ...test, authType: 'header', header: ehp, testName: `${test.testName}@header` });
  }

  if (auth['SHARED_SECRET']?.enabled && spec.sharedSecret?.providerKey && ENVIRONMENT === 'astra') {
    tests.push({ ...test, authType: 'providerKey', providerKey: spec.sharedSecret?.providerKey, testName: `${test.testName}@providerKey` });
  }

  if (auth['NONE']?.enabled && ENVIRONMENT === 'astra') {
    tests.push({ ...test, authType: 'none', testName: `${test.testName}@none` });
  }

  const modelInfo = providerInfo.models.find((m) => m.name === test.modelName)!;

  return tests.flatMap(branchOnDimension(spec, modelInfo));
}

const resolveHeaderProvider = (spec: VectorizeTestSpec[string]) => {
  const headers = Object.entries(spec?.headers ?? []).sort();

  if (headers.length === 0) {
    return null;
  }

  if (headers.length === 1 && headers[0][0] === 'x-embedding-api-key') {
    return new EmbeddingAPIKeyHeaderProvider(headers[0][1]);
  }

  if (headers.length === 2 && headers[0][0] === 'x-embedding-access-id' && headers[1][0] === 'x-embedding-secret-id') {
    return new AWSEmbeddingHeadersProvider(headers[0][1], headers[1][1]);
  }

  throw new Error(`No embeddings header provider resolved for headers ${headers}`);
}

interface DimensionBranch extends AuthBranch {
  dimension?: number,
}

const branchOnDimension = (spec: VectorizeTestSpec[string], modelInfo: EmbeddingProviderModelInfo) => (test: AuthBranch): VectorizeTest[] => {
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

const createVectorizeProvidersTest = (testsCollSupplier: TestCollsSupplier) => {
  it(`has a working lifecycle (${testsCollSupplier.testName})`, async () => {
    for (let i = 0, n = testsCollSupplier.tests.length; i < n; i++) {
      const key = UUID.v4().toString();

      const supplier = testsCollSupplier.tests[i];
      const collection = await supplier.getColl();

      if (supplier.test.loadingTime && i === 0) {
        const _id = UUID.v4();
        try {
          await collection.insertOne({ _id, $vectorize: 'a' });
          await collection.deleteOne({ _id });
        } catch (_) { /* empty */ }
        await new Promise((resolve) => setTimeout(resolve, supplier.test.loadingTime));
      }

      const insertManyResult = await collection.insertMany([
        { name: 'Alice', age: 30, key },
        { name: 'Bob', age: 40, key },
        { name: 'Charlie', age: 50, key },
      ], {
        vectorize: [
          'Alice likes big red cars',
          'Cause maybe, you\'re gonna be the one that saves me... and after all, you\'re my wonderwall...',
          'The water bottle was small',
        ],
      });

      assert.ok(insertManyResult);
      assert.strictEqual(insertManyResult.insertedCount, 3);

      const findOneResult = await collection.findOne({ key }, {
        vectorize: 'Alice likes big red cars',
        includeSimilarity: true,
      });

      assert.ok(findOneResult);
      assert.strictEqual(findOneResult._id, insertManyResult.insertedIds[0]);
      assert.ok(findOneResult.$similarity > 0.8);

      const deleteResult = await collection.deleteOne({ key }, {
        vectorize: 'Alice likes big red cars',
      });

      assert.ok(deleteResult);
      assert.strictEqual(deleteResult.deletedCount, 1);

      const findResult = await collection.find({ key }, {
        vectorize: 'Cause maybe, you\'re gonna be the one that saves me... and after all, you\'re my wonderwall...',
        includeSimilarity: true,
      }).toArray();

      assert.strictEqual(findResult.length, 2);
    }
  });
};

const createVectorizeParamTests = function (db: Db, collName: string, embeddingApiKey?: EmbeddingHeadersProvider) {
  parallel('$vectorize/vectorize params', () => {
    const collection = db.collection(collName, {
      embeddingApiKey: embeddingApiKey,
    });

    before(async function () {
      if (!await db.listCollections({ nameOnly: true }).then(cs => cs.some((c) => c === collName))) {
        this.skip();
      }
    });

    it('should override $vectorize if both are set in insertOne', async (key) => {
      await collection.insertOne({
        _id: key,
        $vectorize: 'The grass was as green as it always was that sinister day',
      }, {
        vectorize: 'The blackbirds sang their song as they always did that black-letter day',
      })

      const result = await collection.findOne({ _id: key }, { projection: { '*': 1 } });
      assert.strictEqual(result?.$vectorize, 'The blackbirds sang their song as they always did that black-letter day');
    });

    it('should override $vectorize if both are set in insertMany', async (key) => {
      await collection.insertMany([
        {
          _id: `${key}1`,
          $vectorize: 'The grass was as green as it always was that sinister day',
        },
        {
          _id: `${key}2`,
          $vectorize: 'The grass was as green as it always was that sinister day',
        },
      ], {
        vectorize: [
          'The blackbirds sang their song as they always did that black-letter day',
          null,
        ],
      });

      const result1 = await collection.findOne({ _id: `${key}1` }, { projection: { '*': 1 } });
      assert.strictEqual(result1?.$vectorize, 'The blackbirds sang their song as they always did that black-letter day');
      const result2 = await collection.findOne({ _id: `${key}2` }, { projection: { '*': 1 } });
      assert.strictEqual(result2?.$vectorize, 'The grass was as green as it always was that sinister day');
    });

    it('should throw an error if vectorize and sort are both set', async (key) => {
      await assert.rejects(async () => {
        await collection.findOne({ key }, { sort: { name: 1 }, vectorize: 'some text' });
      });
      assert.throws(() => {
        collection.find({ key }, { sort: { name: 1 }, vectorize: 'some text' });
      });
      await assert.rejects(async () => {
        await collection.updateOne({ key }, {}, { sort: { name: 1 }, vectorize: 'some text' });
      });
      await assert.rejects(async () => {
        await collection.findOneAndUpdate({ key }, {}, {
          sort: { name: 1 },
          vectorize: 'some text',
          returnDocument: 'before',
        });
      });
      await assert.rejects(async () => {
        await collection.replaceOne({ key }, {}, { sort: { name: 1 }, vectorize: 'some text' });
      });
      await assert.rejects(async () => {
        await collection.findOneAndReplace({ key }, {}, {
          sort: { name: 1 },
          vectorize: 'some text',
          returnDocument: 'before',
        });
      });
      await assert.rejects(async () => {
        await collection.deleteOne({ key }, { sort: { name: 1 }, vectorize: 'some text' });
      });
      await assert.rejects(async () => {
        await collection.findOneAndDelete({ key }, { sort: { name: 1 }, vectorize: 'some text' });
      });
    });
  });
};
