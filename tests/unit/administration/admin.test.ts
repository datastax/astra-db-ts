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
import { AstraAdmin } from '@/src/administration';
import { StaticTokenProvider } from '@/src/lib';
import { AdminOptions, DataAPIClient, DbOptions } from '@/src/client';
import { describe, it } from '@/tests/testlib';
import { DEFAULT_DEVOPS_API_ENDPOINTS } from '@/src/lib/api/constants';
import { InternalRootClientOpts } from '@/src/client/types/internal';
import { $CustomInspect } from '@/src/lib/constants';
import { AdminOptsHandler } from '@/src/client/opts-handlers/admin-opts-handler';
import { DbOptsHandler } from '@/src/client/opts-handlers/db-opts-handler';
import { CallerCfgHandler } from '@/src/client/opts-handlers/caller-cfg-handler';
import { EnvironmentCfgHandler } from '@/src/client/opts-handlers/environment-cfg-handler';

describe('unit.administration.admin', () => {
  const internalOps = (db?: Partial<DbOptions>, devops?: Partial<AdminOptions>, preferredType = 'http2'): InternalRootClientOpts => ({
    dbOptions: DbOptsHandler.parse({ token: new StaticTokenProvider('old'), ...db }),
    adminOptions: AdminOptsHandler.parse({ adminToken: new StaticTokenProvider('old-admin'), ...devops }),
    emitter: null!,
    fetchCtx: { preferredType } as any,
    caller: CallerCfgHandler.parse([]),
    environment: EnvironmentCfgHandler.parse('astra'),
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
