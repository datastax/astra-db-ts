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

import { DEFAULT_KEYSPACE } from '@/src/lib/api';
import { DEFAULT_COLLECTION_NAME, OTHER_KEYSPACE } from '@/tests/testlib/config';
import { GLOBAL_FIXTURES } from '@/tests/testlib';

const TEST_KEYSPACES = [DEFAULT_KEYSPACE, OTHER_KEYSPACE];

before(async () => {
  const { db, dbAdmin } = GLOBAL_FIXTURES;
  const allKeyspaces = await dbAdmin.listKeyspaces();

  if (allKeyspaces.includes('slania')) {
    console.log(`deleting keyspace 'slania'`);
    await dbAdmin.dropKeyspace('slania');
  }

  for (const keyspace of TEST_KEYSPACES) {
    if (!allKeyspaces.includes(keyspace)) {
      console.log(`creating keyspace '${keyspace}'`);
      await dbAdmin.createKeyspace(keyspace);
    }
  }

  const createCollPromises = TEST_KEYSPACES
    .map(async (keyspace) => {
      await db.createCollection(DEFAULT_COLLECTION_NAME, { vector: { dimension: 5, metric: 'cosine' }, keyspace })
        .then(c => c.deleteMany({}));

      // const table = await db.createTable(DEFAULT_TABLE_NAME, {
      //   definition: {
      //     columns: {
      //       id: { type: 'text' },
      //       name: { type: 'text' },
      //       age: { type: 'int' },
      //       // vector: { type: 'vector', valueType: 'float', dimension: 5 },
      //     },
      //     primaryKey: {
      //       partitionBy: ['id'],
      //       partitionSort: { age: 1 },
      //     },
      //   },
      //   checkExists: false,
      // });
      //
      // await table.deleteMany({});

      // await table.createIndex('id_idx', 'id');
      // await table.createIndex('name_idx', 'name');
      // await table.createIndex('age_idx', 'age');
      // await table.createVectorIndex('vector_idx', 'vector', { similarityFunction: 'dot_product' });
    })
    .awaitAll();

  const allCollections = await TEST_KEYSPACES
    .map(async (keyspace) => {
      const colls = await db.listCollections({ keyspace: keyspace, nameOnly: true });
      return [keyspace, colls] as const;
    })
    .awaitAll();

  await allCollections
    .map(async ([keyspace, colls]) => {
      await colls
        .filter(c => TEST_KEYSPACES.includes(keyspace) ? c !== DEFAULT_COLLECTION_NAME : true)
        .tap(c => console.log(`deleting collection '${keyspace}.${c}'`))
        .map(c => db.dropCollection(c, { keyspace: keyspace }))
        .awaitAll();
    })
    .awaitAll();

  await createCollPromises;
});
