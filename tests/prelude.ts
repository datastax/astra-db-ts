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

import dotenv from 'dotenv';
import { DataAPIClient } from '@/src/client';
import { DEFAULT_NAMESPACE } from '@/src/api';
import {
  DEFAULT_COLLECTION_NAME,
  ENVIRONMENT,
  EPHEMERAL_COLLECTION_NAME,
  OTHER_NAMESPACE,
  TEST_APPLICATION_TOKEN,
  TEST_APPLICATION_URI,
} from '@/tests/fixtures';

dotenv.config();

const client = new DataAPIClient(TEST_APPLICATION_TOKEN, {
  httpOptions: { client: 'fetch' },
  dbOptions: { namespace: DEFAULT_NAMESPACE },
  environment: ENVIRONMENT,
});

const db = client.db(TEST_APPLICATION_URI);

(async () => {
  await db.dropCollection(EPHEMERAL_COLLECTION_NAME);

  await db.dropCollection(EPHEMERAL_COLLECTION_NAME, { namespace: OTHER_NAMESPACE });

  await db.createCollection(DEFAULT_COLLECTION_NAME, { vector: { dimension: 5, metric: 'cosine' }, checkExists: false, namespace: OTHER_NAMESPACE })
    .then(c => c.deleteMany());

  await db.createCollection(DEFAULT_COLLECTION_NAME, { vector: { dimension: 5, metric: 'cosine' }, checkExists: false })
    .then(c => c.deleteMany());
})();
