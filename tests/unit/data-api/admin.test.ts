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
import { AstraAdmin, mkAdmin } from '@/src/devops';
import { DEFAULT_DEVOPS_API_ENDPOINT } from '@/src/api';
import { AdminSpawnOptions, DbSpawnOptions } from '@/src/client';

describe('unit.data-api.admin tests', () => {
  const mkOptions = (data?: DbSpawnOptions, devops?: AdminSpawnOptions) => {
    return { dbOptions: { token: 'old', ...data }, adminOptions: { adminToken: 'old-admin', ...devops } };
  }

  describe('constructor tests', () => {
    it('should properly construct an AstraAdmin object', () => {
      const admin = new AstraAdmin(mkOptions());
      assert.ok(admin);
      assert.strictEqual(admin['_httpClient'].baseUrl, DEFAULT_DEVOPS_API_ENDPOINT);
    });

    it('should properly construct an AstraAdmin object with a custom base URL', () => {
      const admin = new AstraAdmin(mkOptions({}, { endpointUrl: 'https://api.astra.datastax.com/v1' }));
      assert.ok(admin);
      assert.strictEqual(admin['_httpClient'].baseUrl, 'https://api.astra.datastax.com/v1');
    });
  });

  describe('mkAdmin tests', () => {
    it('should allow admin construction using default options', () => {
      const admin = mkAdmin(mkOptions({}, { endpointUrl: 'https://api.astra.datastax.com/v1' }), {});
      assert.ok(admin);
      assert.strictEqual(admin['_httpClient'].baseUrl, 'https://api.astra.datastax.com/v1');
    });

    it('should allow admin construction, overwriting options', () => {
      const admin = mkAdmin(mkOptions({}, { endpointUrl: 'https://api.astra.datastax.com/old' }), { adminToken: 'new-admin', endpointUrl: 'https://api.astra.datastax.com/new' });
      assert.ok(admin);
      assert.strictEqual(admin['_httpClient'].baseUrl, 'https://api.astra.datastax.com/new');
    });
  });
});
