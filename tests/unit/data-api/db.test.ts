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
import { Db } from '@/src/data-api';
import { DEFAULT_DATA_API_PATH, DEFAULT_NAMESPACE } from '@/src/api';
import { mkDb } from '@/src/data-api/db';
import { StaticTokenProvider } from '@/src/common';
import { InternalRootClientOpts } from '@/src/client/types';
import { TEST_ASTRA_URI } from '@/tests/fixtures';

describe('unit.data-api.db', () => {
  const internalOps = (data?: Partial<InternalRootClientOpts['dbOptions']>, devops?: Partial<InternalRootClientOpts['adminOptions']>, preferredType = 'http2'): InternalRootClientOpts => ({
    dbOptions: { token: new StaticTokenProvider('old'), monitorCommands: false, ...data },
    adminOptions: { adminToken: new StaticTokenProvider('old-admin'), monitorCommands: false, ...devops },
    emitter: null!,
    fetchCtx: { preferredType } as any,
    userAgent: '',
    environment: 'astra',
  });

  describe('constructor tests', () => {
    it('should allow db construction from endpoint', async () => {
      const db = new Db('https://id-region.apps.astra.datastax.com', internalOps());
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, `https://id-region.apps.astra.datastax.com/${DEFAULT_DATA_API_PATH}`);
      assert.strictEqual(await db['_httpClient'].applicationToken?.getTokenAsString(), 'old');
    });
  });

  describe('mkDb tests', () => {
    it('should allow db construction from endpoint, using default options', async () => {
      const db = mkDb(internalOps(), 'https://id-region.apps.astra.datastax.com');
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, `https://id-region.apps.astra.datastax.com/${DEFAULT_DATA_API_PATH}`);
      assert.strictEqual(await db['_httpClient'].applicationToken?.getTokenAsString(), 'old');
    });

    it('should allow db construction from id + region, using default options', async () => {
      const db = mkDb(internalOps(), 'id', 'region');
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, `https://id-region.apps.astra.datastax.com/${DEFAULT_DATA_API_PATH}`);
      assert.strictEqual(await db['_httpClient'].applicationToken?.getTokenAsString(), 'old');
    });

    it('should allow db construction from endpoint, overwriting options', async () => {
      const db = mkDb(internalOps({ dataApiPath: 'old' }), 'https://id-region.apps.astra.datastax.com', { dataApiPath: 'new', token: 'new' });
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, 'https://id-region.apps.astra.datastax.com/new');
      assert.strictEqual(await db['_httpClient'].applicationToken?.getTokenAsString(), 'new');
    });

    it('should allow db construction from id + region, overwriting options', async () => {
      const db = mkDb(internalOps({ dataApiPath: 'old' }), 'id', 'region', { dataApiPath: 'new', token: 'new' });
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, 'https://id-region.apps.astra.datastax.com/new');
      assert.strictEqual(await db['_httpClient'].applicationToken?.getTokenAsString(), 'new');
    });

    it('is initialized with default namespace', () => {
      const db = mkDb(internalOps(), TEST_ASTRA_URI);
      assert.strictEqual(db.namespace, DEFAULT_NAMESPACE);
    });

    it('uses custon namespace when provided', () => {
      const db = mkDb(internalOps({ namespace: 'new_namespace' }), TEST_ASTRA_URI);
      assert.strictEqual(db.namespace, 'new_namespace');
    });

    it('overrides namespace in db when provided', () => {
      const db = mkDb(internalOps(), TEST_ASTRA_URI, { namespace: 'new_namespace' });
      assert.strictEqual(db.namespace, 'new_namespace');
    });

    it('throws error on empty namespace', () => {
      assert.throws(() => {
        mkDb(internalOps(), TEST_ASTRA_URI, { namespace: '' });
      });
    });

    it('throws error on invalid namespace', () => {
      assert.throws(() => {
        mkDb(internalOps(), TEST_ASTRA_URI, { namespace: 'bad namespace' });
      });
    });

    it('handles different dataApiPath', () => {
      const db = mkDb(internalOps({ dataApiPath: 'api/json/v2' }), TEST_ASTRA_URI);
      assert.strictEqual(db['_httpClient'].baseUrl, `${TEST_ASTRA_URI}/api/json/v2`);
    });

    it('handles different dataApiPath when overridden', () => {
      const db = mkDb(internalOps({ dataApiPath: 'api/json/v2' }), TEST_ASTRA_URI, { dataApiPath: 'api/json/v3' });
      assert.strictEqual(db['_httpClient'].baseUrl, `${TEST_ASTRA_URI}/api/json/v3`);
    });

    it('overrides token in db when provided', async () => {
      const db = mkDb(internalOps(), TEST_ASTRA_URI, { token: 'new' });
      assert.strictEqual(await db['_httpClient'].applicationToken?.getTokenAsString(), 'new');
    });

    it('should accept valid monitorCommands', () => {
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_ASTRA_URI, {}));
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_ASTRA_URI, { monitorCommands: true }));
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_ASTRA_URI, { monitorCommands: false }));
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_ASTRA_URI, { monitorCommands: null! }));
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_ASTRA_URI, { monitorCommands: undefined }));
    });

    it('should throw on invalid monitorCommands', () => {
      // @ts-expect-error - testing invalid input
      assert.throws(() => mkDb(internalOps(), TEST_ASTRA_URI, { monitorCommands: 'invalid' }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => mkDb(internalOps(), TEST_ASTRA_URI, { monitorCommands: 1 }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => mkDb(internalOps(), TEST_ASTRA_URI, { monitorCommands: [] }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => mkDb(internalOps(), TEST_ASTRA_URI, { monitorCommands: {} }));
    });

    it('should accept valid dataApiPath', () => {
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_ASTRA_URI, {}));
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_ASTRA_URI, { dataApiPath: 'api/json/v2' }));
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_ASTRA_URI, { dataApiPath: null! }));
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_ASTRA_URI, { dataApiPath: undefined }));
    });

    it('should throw on invalid dataApiPath', () => {
      // @ts-expect-error - testing invalid input
      assert.throws(() => mkDb(internalOps(), TEST_ASTRA_URI, { dataApiPath: 1 }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => mkDb(internalOps(), TEST_ASTRA_URI, { dataApiPath: [] }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => mkDb(internalOps(), TEST_ASTRA_URI, { dataApiPath: {} }));
    });
  });

  describe('id tests', () => {
    it('should return the id from the endpoint', () => {
      const db = mkDb(internalOps(), 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb', 'us-east1');
      assert.strictEqual(db.id, 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb');
    });

    it('should throw error if attempting to get ID for non-astra db', () => {
      const db = mkDb(internalOps(), 'https://localhost:3000');
      assert.throws(() => { const _id = db.id });
    });
  });

  describe('admin tests', () => {
    it('should return the admin if on astra db', () => {
      const db = mkDb(internalOps(), 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb', 'us-east1');
      assert.strictEqual(db.admin().id, 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb');
    });

    it('should throw error if attempting to get admin for non-astra db', () => {
      const db = mkDb(internalOps(), 'https://localhost:3000');
      assert.throws(() => { const _admin = db.admin() });
    });

    it('should override auth token', async () => {
      const db = mkDb(internalOps({ token: new StaticTokenProvider('old') }), 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb', 'us-east1');
      const admin = db.admin({ adminToken: 'new' });
      assert.strictEqual(await db['_httpClient'].applicationToken?.getTokenAsString(), 'old');
      assert.strictEqual(await admin['_httpClient'].applicationToken?.getTokenAsString(), 'new');
    });
  });
});
