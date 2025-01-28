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
import { DEFAULT_COLLECTION_NAME, DEFAULT_TABLE_NAME, OTHER_KEYSPACE, SKIP_PRELUDE } from '@/tests/testlib/config';
import {
  EverythingTableSchema,
  EverythingTableSchemaWithVectorize,
  GLOBAL_FIXTURES,
  RUNNING_INT_TESTS,
} from '@/tests/testlib';

const TEST_KEYSPACES = [DEFAULT_KEYSPACE, OTHER_KEYSPACE];

before(async () => {
  if (SKIP_PRELUDE) {
    console.warn('Skipping prelude.test.ts due to SKIP_PRELUDE being set');
    return;
  }

  if (!RUNNING_INT_TESTS.ref) {
    console.warn('Skipping prelude.test.ts due to detection of only unit tests being run');
    return;
  }

  const { db, dbAdmin } = GLOBAL_FIXTURES;
  const allKeyspaces = await dbAdmin.listKeyspaces();

  if (allKeyspaces.includes('slania')) {
    console.warn(`deleting keyspace 'slania'`);
    await dbAdmin.dropKeyspace('slania');
  }

  for (const keyspace of TEST_KEYSPACES) {
    if (!allKeyspaces.includes(keyspace)) {
      console.warn(`creating keyspace '${keyspace}'`);
      await dbAdmin.createKeyspace(keyspace);
    }
  }
  
  const createTCPromises = TEST_KEYSPACES
    .map(async (keyspace) => {
      await db.createCollection(DEFAULT_COLLECTION_NAME, { vector: { dimension: 5, metric: 'cosine' }, keyspace })
        .then(c => c.deleteMany({}));

      const table = await db.createTable(DEFAULT_TABLE_NAME, {
        definition: (keyspace === DEFAULT_KEYSPACE) ? EverythingTableSchema : EverythingTableSchemaWithVectorize,
        ifNotExists: true,
        keyspace,
      });

      if (keyspace === DEFAULT_KEYSPACE) {
        await table.createVectorIndex(`vector_idx_${keyspace}`, 'vector', { options: { metric: 'dot_product' }, ifNotExists: true });
      }
      await table.createIndex(`bigint_idx_${keyspace}`, 'bigint', { ifNotExists: true });
    })
    .awaitAll();

  const allCollections = await TEST_KEYSPACES
    .map(async (keyspace) => {
      const colls = await db.listCollections({ keyspace, nameOnly: true });
      return [keyspace, colls] as const;
    })
    .awaitAll();

  const allTables = await TEST_KEYSPACES
    .map(async (keyspace) => {
      const tables = await db.listTables({ keyspace, nameOnly: true });
      return [keyspace, tables] as const;
    })
    .awaitAll();

  const delCollections = allCollections
    .map(async ([keyspace, colls]) => {
      await colls
        .filter(c => TEST_KEYSPACES.includes(keyspace) ? c !== DEFAULT_COLLECTION_NAME : true)
        .tap(c => console.warn(`deleting collection '${keyspace}.${c}'`))
        .map(c => db.dropCollection(c, { keyspace }))
        .awaitAll();
    })
    .awaitAll();

  const delTables = allTables
    .map(async ([keyspace, tables]) => {
      await tables
        .filter(t => TEST_KEYSPACES.includes(keyspace) ? t !== DEFAULT_TABLE_NAME : true)
        .tap(t => console.warn(`deleting table '${keyspace}.${t}'`))
        .map(t => db.dropTable(t, { keyspace }))
        .awaitAll();
    })
    .awaitAll();

  await delCollections;
  await delTables;
  await createTCPromises;
});
