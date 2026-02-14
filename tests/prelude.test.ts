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

import { DEFAULT_KEYSPACE } from '@/src/lib/api/index.js';
import {
  Cfg,
} from '@/tests/testlib/config.js';
import {
  EverythingTableSchema,
  EverythingTableSchemaWithVectorize,
  ExampleUDTSchema,
  GLOBAL_FIXTURES,
  RUNNING_INT_TESTS,
} from '@/tests/testlib/index.js';
import type { InferTableSchema } from '@/src/db/index.js';
import { spinner } from 'zx';
import * as readline from 'node:readline';

const TEST_KEYSPACES = [DEFAULT_KEYSPACE, Cfg.OtherKeyspace];

before(async () => {
  if (Cfg.SkipPrelude) {
    console.warn('Skipping prelude.test.ts due to SKIP_PRELUDE being set');
    return;
  }

  if (!RUNNING_INT_TESTS.ref) {
    console.warn('Skipping prelude.test.ts due to detection of only unit tests being run');
    return;
  }

  console.warn('Running prelude.test.ts');

  const { db, dbAdmin } = GLOBAL_FIXTURES;

  await spinner('Setting up keyspaces', async () => {
    const allKeyspaces = await dbAdmin.listKeyspaces();

    if (allKeyspaces.includes('slania')) {
      readline.clearLine(process.stdout, 0);
      console.warn(`\rdeleting keyspace 'slania'`);
      await dbAdmin.dropKeyspace('slania');
    }

    for (const keyspace of TEST_KEYSPACES) {
      if (!allKeyspaces.includes(keyspace)) {
        readline.clearLine(process.stdout, 0);
        console.warn(`\rcreating keyspace '${keyspace}'`);
        await dbAdmin.createKeyspace(keyspace);
      }
    }
  });

  const createUDTPromises = TEST_KEYSPACES
    .map(async (keyspace) => {
      await db.createType('example_udt', {
        definition: ExampleUDTSchema,
        ifNotExists: true,
        keyspace,
      });
    })
    .awaitAll();

  const createTCPromises = TEST_KEYSPACES
    .map(async (keyspace) => {
      await db.createCollection(Cfg.DefaultCollectionName, {
        vector: (keyspace === DEFAULT_KEYSPACE) ?
          { dimension: 5, metric: 'cosine' } :
          { dimension: Cfg.VectorizeVectorLength, service: { provider: 'openai', modelName: 'text-embedding-3-small' } },
        keyspace,
      }).then(c => c.deleteMany({}));

      const table = await db.createTable(Cfg.DefaultTableName, {
        definition: (keyspace === DEFAULT_KEYSPACE) ? EverythingTableSchema : EverythingTableSchemaWithVectorize,
        ifNotExists: true,
        keyspace,
      });
      await table.deleteMany({});

      if (keyspace === DEFAULT_KEYSPACE) {
        await table.createVectorIndex(`vector_idx_${keyspace}`, 'vector' as keyof InferTableSchema<typeof table>, { options: { metric: 'dot_product' }, ifNotExists: true });
      }
      await table.createIndex(`bigint_idx_${keyspace}`, 'bigint', { ifNotExists: true });
    })
    .awaitAll();

  const allCollections = TEST_KEYSPACES
    .map(async (keyspace) => {
      const colls = await db.listCollections({ keyspace, nameOnly: true });
      return [keyspace, colls] as const;
    })
    .awaitAll();

  const allTables = TEST_KEYSPACES
    .map(async (keyspace) => {
      const tables = await db.listTables({ keyspace, nameOnly: true });
      return [keyspace, tables] as const;
    })
    .awaitAll();

  const delCollections = allCollections.then((allColls) => allColls
    .map(async ([keyspace, colls]) => {
      await colls
        .filter(c => TEST_KEYSPACES.includes(keyspace) ? c !== Cfg.DefaultCollectionName : true)
        .tap(c => console.warn(`deleting collection '${keyspace}.${c}'`))
        .map(c => db.dropCollection(c, { keyspace }))
        .awaitAll();
    })
    .awaitAll(),
  );

  const delTables = allTables.then((allTables) => allTables
    .map(async ([keyspace, tables]) => {
      await tables
        .filter(t => TEST_KEYSPACES.includes(keyspace) ? t !== Cfg.DefaultTableName : true)
        .tap(t => console.warn(`deleting table '${keyspace}.${t}'`))
        .map(t => db.dropTable(t, { keyspace }))
        .awaitAll();
    })
    .awaitAll(),
  );

  await spinner('Deleting all collections...', () => delCollections);
  await spinner('Deleting all tables...', () => delTables);
  await spinner('Creating UDTs...', () => createUDTPromises);
  await spinner('Creating all collections and tables...', () => createTCPromises);
});
