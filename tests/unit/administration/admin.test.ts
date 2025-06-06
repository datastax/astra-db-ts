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

import assert from 'assert';
import { AstraAdmin } from '@/src/administration/index.js';
import { StaticTokenProvider, TokenProvider } from '@/src/lib/index.js';
import type { AdminOptions, DbOptions } from '@/src/client/index.js';
import { DataAPIClient } from '@/src/client/index.js';
import { describe, it } from '@/tests/testlib/index.js';
import { DEFAULT_DEVOPS_API_ENDPOINTS } from '@/src/lib/api/constants.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import { AdminOptsHandler } from '@/src/client/opts-handlers/admin-opts-handler.js';
import { RootOptsHandler } from '@/src/client/opts-handlers/root-opts-handler.js';

describe('unit.administration.admin', () => {
  const internalOps = (db?: Partial<DbOptions>, devops?: Partial<AdminOptions>) => RootOptsHandler(TokenProvider.opts.empty, null!).parse({
    dbOptions: { token: new StaticTokenProvider('old'), ...db },
    adminOptions: { adminToken: new StaticTokenProvider('old-admin'), ...devops },
  });

  describe('constructor tests', () => {
    it('should properly construct an AstraAdmin object', () => {
      const admin = new AstraAdmin(internalOps(), AdminOptsHandler.empty);
      assert.ok(admin);
      assert.strictEqual(admin._httpClient.baseUrl, DEFAULT_DEVOPS_API_ENDPOINTS.prod);
    });

    it('should properly construct an AstraAdmin object with a custom astra environment', () => {
      const admin = new AstraAdmin(internalOps({}, { astraEnv: 'dev' }), AdminOptsHandler.empty);
      assert.ok(admin);
      assert.strictEqual(admin._httpClient.baseUrl, 'https://api.dev.cloud.datastax.com/v2');
    });

    it('should not throw on missing token', () => {
      const client = new DataAPIClient();
      assert.doesNotThrow(() => client.admin());
    });

    it('should allow admin construction using default options', () => {
      const admin = new AstraAdmin(internalOps({}, { endpointUrl: 'https://api.astra.datastax.com/v1' }), AdminOptsHandler.empty);
      assert.ok(admin);
      assert.strictEqual(admin._httpClient.baseUrl, 'https://api.astra.datastax.com/v1');
    });

    it('should allow admin construction, overwriting options', () => {
      const admin = new AstraAdmin(internalOps({}, {}), AdminOptsHandler.parse({
        adminToken: new StaticTokenProvider('new-admin'),
        astraEnv: 'dev',
      }));
      assert.ok(admin);
      assert.strictEqual(admin._httpClient.baseUrl, 'https://api.dev.cloud.datastax.com/v2');
    });
  });

  describe('db', () => {
    it('throws if detects invalid .db(endpoint, keyspace)', () => {
      const admin = new AstraAdmin(internalOps(), AdminOptsHandler.empty);
      assert.throws(() => admin.db('https://test.com/', 'keyspace'), { message: 'Unexpected db() argument: database id can\'t start with "http(s)://". Did you mean to call `.db(endpoint, { keyspace })`?' });
    });
  });

  it('should inspect properly', () => {
    const admin = new AstraAdmin(internalOps(), AdminOptsHandler.empty);
    assert.strictEqual((admin as any)[$CustomInspect](), 'AstraAdmin()');
  });
});
