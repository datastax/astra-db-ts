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

import { DEFAULT_KEYSPACE } from '@/src/api';
import { DEFAULT_COLLECTION_NAME, OTHER_KEYSPACE } from '@/tests/testlib/config';
import { GLOBAL_FIXTURES } from '@/tests/testlib';

const TEST_KEYSPACES = [DEFAULT_KEYSPACE, OTHER_KEYSPACE];

before(async () => {
  const { db, dbAdmin } = GLOBAL_FIXTURES;
  const allNamespaces = await dbAdmin.listKeyspaces();

  if (allNamespaces.includes('slania')) {
    console.log(`deleting namespace 'slania'`);
    await dbAdmin.dropKeyspace('slania');
  }

  for (const namespace of TEST_KEYSPACES) {
    if (!allNamespaces.includes(namespace)) {
      console.log(`creating namespace '${namespace}'`);
      await dbAdmin.createKeyspace(namespace);
    }
  }

  const createCollPromises = TEST_KEYSPACES
    .map(async (namespace) => {
      await db.createCollection(DEFAULT_COLLECTION_NAME, { vector: { dimension: 5, metric: 'cosine' }, checkExists: false, namespac3: namespace })
        .then(c => c.deleteMany({}));
    })
    .awaitAll();

  const allCollections = await TEST_KEYSPACES
    .map(async (namespace) => {
      const colls = await db.listCollections({ namespac3: namespace, nameOnly: true });
      return [namespace, colls] as const;
    })
    .awaitAll();

  await allCollections
    .map(async ([namespace, colls]) => {
      await colls
        .filter(c => TEST_KEYSPACES.includes(namespace) ? c !== DEFAULT_COLLECTION_NAME : true)
        .tap(c => console.log(`deleting collection '${namespace}.${c}'`))
        .map(c => db.dropCollection(c, { namespac3: namespace }))
        .awaitAll();
    })
    .awaitAll();

  await createCollPromises;
});
