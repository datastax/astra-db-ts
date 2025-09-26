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
import { Cfg, describe, it } from '@/tests/testlib/index.js';
import { DataAPIDbAdmin, DevOpsAPITimeoutError } from '@/src/administration/index.js';

describe('integration.administration.db-admin', ({ client, dbAdmin }) => {
  it('(LONG) works', async () => {
    let succeeded = 0;
    let warnings = 0;
    let polling = 0;

    client.on('adminCommandSucceeded', () => {
      succeeded++;
    });

    client.on('adminCommandWarnings', () => {
      warnings++;
    });

    client.on('adminCommandPolling', () => {
      polling++;
    });

    const db = client.db(Cfg.DbUrl);

    const dbAdmin = (Cfg.DbEnvironment === 'astra')
      ? db.admin({ environment: Cfg.DbEnvironment })
      : db.admin({ environment: Cfg.DbEnvironment });

    await dbAdmin.createKeyspace('slania', { updateDbKeyspace: true });
    assert.strictEqual(db.keyspace, 'slania');

    const keyspaces2 = await dbAdmin.listKeyspaces();
    assert.ok(keyspaces2.includes('slania'));

    await dbAdmin.dropKeyspace('slania');
    assert.strictEqual(db.keyspace, 'slania');

    const keyspaces3 = await dbAdmin.listKeyspaces();
    assert.ok(!keyspaces3.includes('slania'));

    assert.strictEqual(succeeded, 4);
    assert.strictEqual(warnings, 0);

    if (dbAdmin as unknown instanceof DataAPIDbAdmin) {
      assert.strictEqual(polling, 0);
    } else {
      assert.ok(polling > 0);
    }
  });

  it('should findEmbeddingProviders', async () => {
    const { embeddingProviders } = await dbAdmin.findEmbeddingProviders();
    assert.ok(typeof embeddingProviders === 'object');
  });

  it('should findEmbeddingProviders w/ modelStatusFilter', async () => {
    const { embeddingProviders } = await dbAdmin.findEmbeddingProviders({ filterModelStatus: 'DEPRECATED' });
    assert.ok(typeof embeddingProviders === 'object');
  });

  it('(RERANKING) should findRerankingProviders', async () => {
    const { rerankingProviders } = await dbAdmin.findRerankingProviders();
    assert.ok(typeof rerankingProviders === 'object');
  });

  it('(RERANKING) should findRerankingProviders w/ modelStatusFilter', async () => {
      const { rerankingProviders } = await dbAdmin.findRerankingProviders();
      assert.ok(typeof rerankingProviders === 'object');
  });

  it('(ASTRA) should timeout', async () => {
    await assert.rejects(() => dbAdmin.listKeyspaces({ timeout: 1 }), (e) => {
      assert.ok(e instanceof DevOpsAPITimeoutError);
      assert.strictEqual(e.message, 'Command timed out after 1ms (The timeout provided via `{ timeout: <number> }` timed out)');
      assert.strictEqual(e.timedOutCategories, 'provided');
      assert.deepStrictEqual(e.timeout, { requestTimeoutMs: 1, keyspaceAdminTimeoutMs: 1 });
      assert.strictEqual(typeof e.url, 'string');
      return true;
    });
  });
});
