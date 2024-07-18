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

import { DEFAULT_COLLECTION_NAME, ENVIRONMENT, initTestObjects, OTHER_NAMESPACE } from '@/tests/fixtures';
import { DEFAULT_NAMESPACE } from '@/src/api';

before(async () => {
  const [, db] = await initTestObjects();

  await db.createCollection(DEFAULT_COLLECTION_NAME, { vector: { dimension: 5, metric: 'cosine' }, checkExists: false, namespace: OTHER_NAMESPACE })
    .then(c => c.deleteMany({}));

  await db.createCollection(DEFAULT_COLLECTION_NAME, { vector: { dimension: 5, metric: 'cosine' }, checkExists: false })
    .then(c => c.deleteMany({}));
});
