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

import { initTestObjects } from '@/tests/fixtures';
import { DEFAULT_NAMESPACE } from '@/src/api';
import { DEFAULT_COLLECTION_NAME, OTHER_NAMESPACE } from '@/tests/config';

before(async () => {
  const { db, dbAdmin } = initTestObjects();

  const namespaces = await db.command({ findNamespaces: {} }, { namespace: null });

  for (const namespace of [DEFAULT_NAMESPACE, OTHER_NAMESPACE]) {
    if (!namespaces.status?.namespaces.includes(namespace)) {
      console.log(`creating namespace ${namespace}`);
      await dbAdmin.createNamespace(namespace);
    }

    const collections = await db.listCollections({ namespace });

    const promises = collections
      .filter(c => c.name !== DEFAULT_COLLECTION_NAME)
      .tap(c => console.log(`deleting collection '${c.name}'`))
      .map(c => db.dropCollection(c.name));

    await Promise.all(promises);
  }

  await db.createCollection(DEFAULT_COLLECTION_NAME, { vector: { dimension: 5, metric: 'cosine' }, checkExists: false, namespace: OTHER_NAMESPACE })
    .then(c => c.deleteMany({}));

  await db.createCollection(DEFAULT_COLLECTION_NAME, { vector: { dimension: 5, metric: 'cosine' }, checkExists: false })
    .then(c => c.deleteMany({}));
});
