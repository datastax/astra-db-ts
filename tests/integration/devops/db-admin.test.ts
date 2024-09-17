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
// noinspection DuplicatedCode

import assert from 'assert';
import { ENVIRONMENT, it, parallel, TEST_APPLICATION_URI } from '@/tests/testlib';

parallel('integration.devops.db-admin', ({ client, dbAdmin }) => {
  it('{LONG} works', async () => {
    const db = client.db(TEST_APPLICATION_URI);

    const dbAdmin = (ENVIRONMENT === 'astra')
      ? db.admin({ environment: ENVIRONMENT })
      : db.admin({ environment: ENVIRONMENT });

    const namespaces1 = await dbAdmin.listKeyspaces();
    assert.ok(!namespaces1.includes('slania'));

    await dbAdmin.createKeyspace('slania', { updateDbNamespace: true });
    assert.strictEqual(db.keyspace, 'slania');

    const namespaces2 = await dbAdmin.listKeyspaces();
    assert.ok(namespaces2.includes('slania'));

    await dbAdmin.dropKeyspace('slania');
    assert.strictEqual(db.keyspace, 'slania');

    const namespaces3 = await dbAdmin.listKeyspaces();
    assert.ok(!namespaces3.includes('slania'));
  });

  it('should findEmbeddingProviders', async () => {
    const { embeddingProviders } = await dbAdmin.findEmbeddingProviders();
    assert.ok(typeof embeddingProviders === 'object');
  });
});
