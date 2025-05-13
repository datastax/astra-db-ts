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
import type { Collection } from '@/src/documents/index.js';
import { UUID } from '@/src/documents/index.js';
import * as fs from 'fs';
import { Cfg, describe, it, parallel } from '@/tests/testlib/index.js';
import type { FinalVectorizeTestBranch } from '@/tests/testlib/vectorize/vec-test-branches.js';
import { branchOnModel } from '@/tests/testlib/vectorize/vec-test-branches.js';
import type { VectorizeTestGroup } from '@/tests/testlib/vectorize/vec-test-groups.js';
import { createTestGroups } from '@/tests/testlib/vectorize/vec-test-groups.js';
import type { Db } from '@/src/db/index.js';
import sp from 'synchronized-promise';
import type { DbAdmin } from '@/src/administration/index.js';

export type VectorizeTestSpec = Record<string, {
    headers?: Record<`x-${string}`, string>
    sharedSecret?: {
      providerKey?: string,
    }
    dimension?: Record<string, number>,
    parameters?: Record<string, Record<string, string>>,
    warmupErr?: string,
  }>;

const createTestBranches = (dbAdmin: DbAdmin): FinalVectorizeTestBranch[] => {
  if (!fs.existsSync('vectorize_test_spec.json')) {
    return [];
  }

  const spec = JSON.parse(fs.readFileSync('vectorize_test_spec.json', 'utf8')) as VectorizeTestSpec;

  if (Object.entries(spec).length === 0) {
    return [];
  }

  const { embeddingProviders } = sp.default(() => dbAdmin.findEmbeddingProviders())();

  return Object.entries(embeddingProviders)
    .flatMap(branchOnModel(spec))
    .filter(Cfg.VectorizeWhitelist.test);
};

const createVectorizeProvidersTest = (db: Db, batchIdx: number) => (group: VectorizeTestGroup) => {
  it(`has a working lifecycle (${group.groupName})`, async () => {
    let collection: Collection;

    if (batchIdx !== 0) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    for (let i = 0, n = group.tests.length; i < n; i++) {
      const key = UUID.v4().toString();

      const test = group.tests[i];
      collection = await test.coll(db);

      while (test.branch.warmupErr) {
        try {
          await collection.findOne({ key }, {
            sort: { $vectorize: 'amaryllis' },
          });
          break;
        } catch (e: any) {
          if (test.branch.warmupErr.test(e.message)) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } else {
            throw e;
          }
        }
      }

      const insertManyResult = await collection.insertMany([
        { name: 'Alice', age: 30, $vectorize: 'Alice likes big red cars', key },
        { name: 'Bob', age: 40, $vectorize: 'Cause maybe, you\'re gonna be the one that saves me... and after all, you\'re my wonderwall...', key },
        { name: 'Charlie', age: 50, $vectorize: 'The water bottle was small', key },
      ]);

      assert.ok(insertManyResult);
      assert.strictEqual(insertManyResult.insertedCount, 3);

      const findOneResult = await collection.findOne({ key }, {
        sort: { $vectorize: 'Alice likes big red cars' },
        includeSimilarity: true,
      });

      assert.ok(findOneResult);
      assert.strictEqual(findOneResult._id, insertManyResult.insertedIds[0]);
      assert.ok(findOneResult.$similarity! > 0.8);

      const deleteResult = await collection.deleteOne({ key }, {
        sort: { $vectorize: 'Alice likes big red cars' },
      });

      assert.ok(deleteResult);
      assert.strictEqual(deleteResult.deletedCount, 1);

      const findResult = await collection.find({ key }, {
        sort: { $vectorize: 'Cause maybe, you\'re gonna be the one that saves me... and after all, you\'re my wonderwall...' },
        includeSimilarity: true,
      }).toArray();

      assert.strictEqual(findResult.length, 2);
    }
  });
};

describe('(VECTORIZE) (LONG) integration.documents.vectorize', ({ db, dbAdmin }) => {
  const tests = createTestBranches(dbAdmin);
  const groups = createTestGroups(tests);

  for (let i = 0, n = groups.length; i < n; i += 6) {
    parallel('(VECTORIZE) generated tests', { drop: 'colls:after' }, () => {
      groups.slice(i, i + 6).forEach(createVectorizeProvidersTest(db, i));
    });
  }
});
