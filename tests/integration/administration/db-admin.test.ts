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
import { describe, ENVIRONMENT, initTestObjects, it, TEST_APPLICATION_URI } from '@/tests/testlib';

describe('integration.administration.db-admin', ({ dbAdmin }) => {
  it('(LONG) works', async () => {
    const { client } = initTestObjects({ monitoring: true });
    let cmdsSucceeded = 0;

    client.on('adminCommandSucceeded', (e) => {
      assert.strictEqual(e.warnings.length, 0);
      cmdsSucceeded++;
    });

    const db = client.db(TEST_APPLICATION_URI);

    const dbAdmin = (ENVIRONMENT === 'astra')
      ? db.admin({ environment: ENVIRONMENT })
      : db.admin({ environment: ENVIRONMENT });

    const keyspaces1 = await dbAdmin.listKeyspaces();
    assert.ok(!keyspaces1.includes('slania'));

    await dbAdmin.createKeyspace('slania', { updateDbKeyspace: true });
    assert.strictEqual(db.keyspace, 'slania');

    const keyspaces2 = await dbAdmin.listKeyspaces();
    assert.ok(keyspaces2.includes('slania'));

    await dbAdmin.dropKeyspace('slania');
    assert.strictEqual(db.namespace, 'slania');

    const keyspaces3 = await dbAdmin.listKeyspaces();
    assert.ok(!keyspaces3.includes('slania'));

    assert.strictEqual(cmdsSucceeded, 5);
  });

  it('(LONG) (NOT-ASTRA) works w/ legacy namespace', async () => {
    const { client } = initTestObjects({ monitoring: true });
    let cmdsSucceeded = 0;

    client.on('adminCommandSucceeded', (e) => {
      assert.strictEqual(e.warnings.length, 1);
      assert.ok(e.warnings[0].includes('Namespace'));
      assert.ok(e.warnings[0].includes('deprecated'));
      cmdsSucceeded++;
    });

    const db = client.db(TEST_APPLICATION_URI);

    const dbAdmin = (ENVIRONMENT === 'astra')
      ? db.admin({ environment: ENVIRONMENT })
      : db.admin({ environment: ENVIRONMENT });

    const keyspaces1 = await dbAdmin.listNamespaces();
    assert.ok(!keyspaces1.includes('slania'));

    await dbAdmin.createNamespace('slania', { updateDbNamespace: true });
    assert.strictEqual(db.keyspace, 'slania');

    const keyspaces2 = await dbAdmin.listNamespaces();
    assert.ok(keyspaces2.includes('slania'));

    await dbAdmin.dropNamespace('slania');
    assert.strictEqual(db.namespace, 'slania');

    const keyspaces3 = await dbAdmin.listNamespaces();
    assert.ok(!keyspaces3.includes('slania'));

    assert.strictEqual(cmdsSucceeded, 5);
  });

  it('should findEmbeddingProviders', async () => {
    const { embeddingProviders } = await dbAdmin.findEmbeddingProviders();
    assert.ok(typeof embeddingProviders === 'object');
  });
});
