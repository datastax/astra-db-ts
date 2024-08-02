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

import { initTestObjects } from '@/tests/testlib/fixtures';
import { DEFAULT_NAMESPACE } from '@/src/api';
import { DEFAULT_COLLECTION_NAME, OTHER_NAMESPACE } from '@/tests/testlib/config';

before(async () => {
  const { db, dbAdmin } = initTestObjects();

  const allNamespaces = await dbAdmin.listNamespaces();

  if (allNamespaces.includes('slania')) {
    console.log(`deleting namespace 'slania'`);
    await dbAdmin.dropNamespace('slania');
  }

  for (const namespace of [DEFAULT_NAMESPACE, OTHER_NAMESPACE]) {
    if (!allNamespaces.includes(namespace)) {
      console.log(`creating namespace 'slania'`);
      await dbAdmin.createNamespace(namespace);
    }
  }

  const createCollPromises = [DEFAULT_NAMESPACE, OTHER_NAMESPACE]
    .map(async (namespace) => {
      await db.createCollection(DEFAULT_COLLECTION_NAME, { vector: { dimension: 5, metric: 'cosine' }, checkExists: false, namespace })
        .then(c => c.deleteMany({}));
    })
    .awaitAll();

  const allCollections = await allNamespaces
    .map(async (namespace) => {
      const colls = await db.listCollections({ namespace, nameOnly: true });
      return [namespace, colls] as const;
    })
    .awaitAll();

  await allCollections
    .map(async ([namespace, colls]) => {
      return colls
        .filter(c => [DEFAULT_NAMESPACE, OTHER_NAMESPACE].includes(namespace) ? c !== DEFAULT_COLLECTION_NAME : true)
        .tap(c => console.log(`deleting collection '${namespace}.${c}'`))
        .map(c => db.dropCollection(c, { namespace }))
        .awaitAll();
    })
    .awaitAll();

  await createCollPromises;
});
