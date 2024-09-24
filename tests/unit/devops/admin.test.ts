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
import { InternalRootClientOpts } from '@/src/client/types';
import { StaticTokenProvider } from '@/src/lib';
import { DataAPIClient } from '@/src/client';
import { describe, it } from '@/tests/testlib';
import { DEFAULT_DEVOPS_API_ENDPOINTS } from '@/src/lib/api/constants';

describe('unit.devops.admin', () => {
  const internalOps = (data?: Partial<InternalRootClientOpts['dbOptions']>, devops?: Partial<InternalRootClientOpts['adminOptions']>, preferredType = 'http2'): InternalRootClientOpts => ({
    dbOptions: { token: new StaticTokenProvider('old'), monitorCommands: false, ...data },
    adminOptions: { adminToken: new StaticTokenProvider('old-admin'), monitorCommands: false, ...devops },
    emitter: null!,
    fetchCtx: { preferredType } as any,
    userAgent: '',
    environment: 'astra',
  });

  describe('constructor tests', () => {
    it('should properly construct an AstraAdmin object', () => {
      const admin = new AstraAdmin(internalOps());
      assert.ok(admin);
      assert.strictEqual(admin['_httpClient'].baseUrl, DEFAULT_DEVOPS_API_ENDPOINTS.prod);
    });

    it('should properly construct an AstraAdmin object with a custom base URL', () => {
      const admin = new AstraAdmin(internalOps({}, { endpointUrl: 'https://api.astra.datastax.com/v1' }));
      assert.ok(admin);
      assert.strictEqual(admin['_httpClient'].baseUrl, 'https://api.astra.datastax.com/v1');
    });

    it('should not throw on missing token', () => {
      const client = new DataAPIClient();
      assert.doesNotThrow(() => client.admin());
    });

    it('should allow admin construction using default options', () => {
      const admin = new AstraAdmin(internalOps({}, { endpointUrl: 'https://api.astra.datastax.com/v1' }), {});
      assert.ok(admin);
      assert.strictEqual(admin['_httpClient'].baseUrl, 'https://api.astra.datastax.com/v1');
    });

    it('should allow admin construction, overwriting options', () => {
      const admin = new AstraAdmin(internalOps({}, { endpointUrl: 'https://api.astra.datastax.com/old' }), {
        adminToken: 'new-admin',
        endpointUrl: 'https://api.astra.datastax.com/new',
      });
      assert.ok(admin);
      assert.strictEqual(admin['_httpClient'].baseUrl, 'https://api.astra.datastax.com/new');
    });
  });
});
