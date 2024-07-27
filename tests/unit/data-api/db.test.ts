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
import { DEFAULT_DATA_API_PATHS, DEFAULT_NAMESPACE } from '@/src/api';
import { mkDb } from '@/src/data-api/db';
import { StaticTokenProvider } from '@/src/common';
import { InternalRootClientOpts } from '@/src/client/types';
import { DataAPIClient } from '@/src/client';
import { describe, it } from '@/tests/test-utils';
import { DEMO_APPLICATION_URI, TEST_APPLICATION_URI } from '@/tests/config';

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
    it('should allow db construction from endpoint', () => {
      const db = new Db('https://id-region.apps.astra.datastax.com', internalOps(), null);
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, `https://id-region.apps.astra.datastax.com/${DEFAULT_DATA_API_PATHS['astra']}`);
    });

    it('should not throw on missing token', () => {
      const client = new DataAPIClient();
      assert.doesNotThrow(() => client.db(TEST_APPLICATION_URI));
    });
  });

  describe('mkDb tests', () => {
    it('should allow db construction from endpoint, using default options', () => {
      const db = mkDb(internalOps(), 'https://id-region.apps.astra.datastax.com', null, null);
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, `https://id-region.apps.astra.datastax.com/${DEFAULT_DATA_API_PATHS['astra']}`);
    });

    it('should allow db construction from id + region, using default options', () => {
      const db = mkDb(internalOps(), 'id', 'region', null);
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, `https://id-region.apps.astra.datastax.com/${DEFAULT_DATA_API_PATHS['astra']}`);
    });

    it('should allow db construction from endpoint, overwriting options', () => {
      const db = mkDb(internalOps({ dataApiPath: 'old', namespace: 'old' }), 'https://id-region.apps.astra.datastax.com', { dataApiPath: 'new', namespace: 'new' }, null);
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, 'https://id-region.apps.astra.datastax.com/new');
      assert.strictEqual(db.namespace, 'new');
    });

    it('should allow db construction from id + region, overwriting options', () => {
      const db = mkDb(internalOps({ dataApiPath: 'old', namespace: 'old' }), 'id', 'region', { dataApiPath: 'new', namespace: 'new' });
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, 'https://id-region.apps.astra.datastax.com/new');
      assert.strictEqual(db.namespace, 'new');
    });

    it('is initialized with default namespace', () => {
      const db = mkDb(internalOps(), TEST_APPLICATION_URI, null, null);
      assert.strictEqual(db.namespace, DEFAULT_NAMESPACE);
    });

    it('uses custom namespace when provided', () => {
      const db = mkDb(internalOps({ namespace: 'new_namespace' }), TEST_APPLICATION_URI, null, null);
      assert.strictEqual(db.namespace, 'new_namespace');
    });

    it('overrides namespace in db when provided', () => {
      const db = mkDb(internalOps(), TEST_APPLICATION_URI, { namespace: 'new_namespace' }, null);
      assert.strictEqual(db.namespace, 'new_namespace');
    });

    it('throws error on empty namespace', () => {
      assert.throws(() => {
        mkDb(internalOps(), TEST_APPLICATION_URI, { namespace: '' }, null);
      });
    });

    it('throws error on invalid namespace', () => {
      assert.throws(() => {
        mkDb(internalOps(), TEST_APPLICATION_URI, { namespace: 'bad namespace' }, null);
      });
    });

    it('handles different dataApiPath', () => {
      const db = mkDb(internalOps({ dataApiPath: 'api/json/v2' }), TEST_APPLICATION_URI, null, null);
      assert.strictEqual(db['_httpClient'].baseUrl, `${TEST_APPLICATION_URI}/api/json/v2`);
    });

    it('handles different dataApiPath when overridden', () => {
      const db = mkDb(internalOps({ dataApiPath: 'api/json/v2' }), TEST_APPLICATION_URI, { dataApiPath: 'api/json/v3' }, null);
      assert.strictEqual(db['_httpClient'].baseUrl, `${TEST_APPLICATION_URI}/api/json/v3`);
    });

    it('should accept valid monitorCommands', () => {
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_APPLICATION_URI, {}, null));
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_APPLICATION_URI, { monitorCommands: true }, null));
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_APPLICATION_URI, { monitorCommands: false }, null));
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_APPLICATION_URI, { monitorCommands: null! }, null));
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_APPLICATION_URI, { monitorCommands: undefined }, null));
    });

    it('should throw on invalid monitorCommands', () => {
      // @ts-expect-error - testing invalid input
      assert.throws(() => mkDb(internalOps(), TEST_APPLICATION_URI, { monitorCommands: 'invalid' }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => mkDb(internalOps(), TEST_APPLICATION_URI, { monitorCommands: 1 }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => mkDb(internalOps(), TEST_APPLICATION_URI, { monitorCommands: [] }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => mkDb(internalOps(), TEST_APPLICATION_URI, { monitorCommands: {} }));
    });

    it('should accept valid dataApiPath', () => {
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_APPLICATION_URI, {}, null));
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_APPLICATION_URI, { dataApiPath: 'api/json/v2' }, null));
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_APPLICATION_URI, { dataApiPath: null! }, null));
      assert.doesNotThrow(() => mkDb(internalOps(), TEST_APPLICATION_URI, { dataApiPath: undefined }, null));
    });

    it('should throw on invalid dataApiPath', () => {
      // @ts-expect-error - testing invalid input
      assert.throws(() => mkDb(internalOps(), TEST_APPLICATION_URI, { dataApiPath: 1 }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => mkDb(internalOps(), TEST_APPLICATION_URI, { dataApiPath: [] }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => mkDb(internalOps(), TEST_APPLICATION_URI, { dataApiPath: {} }));
    });
  });

  describe('id tests', () => {
    it('should return the id from the endpoint', () => {
      const db = mkDb(internalOps(), 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb', 'us-east1', null);
      assert.strictEqual(db.id, 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb');
    });

    it('should throw error if attempting to get ID for non-astra db', () => {
      const db = mkDb(internalOps(), 'https://localhost:3000', null, null);
      assert.throws(() => { db.id });
    });
  });

  describe('namespace tests', () => {
    it('should return the namespace passed into the constructor', () => {
      const db = mkDb(internalOps({ namespace: 'namespace' }), TEST_APPLICATION_URI, {}, null);
      assert.strictEqual(db.namespace, 'namespace');
    });

    it('should throw an error if the namespace is not set in the namespace', () => {
      const db = mkDb({ ...internalOps(), environment: 'dse' }, TEST_APPLICATION_URI, {}, null);
      assert.throws(() => db.namespace);
    });

    it('should mutate the namespace (non-retroactively)', () => {
      const db = mkDb(internalOps({ namespace: 'namespace' }), TEST_APPLICATION_URI, {}, null);
      const coll1 = db.collection('coll');
      assert.strictEqual(db.namespace, 'namespace');
      assert.strictEqual(coll1.namespace, 'namespace');

      db.useNamespace('other_namespace');
      const coll2 = db.collection('coll');
      assert.strictEqual(db.namespace, 'other_namespace');
      assert.strictEqual(coll1.namespace, 'namespace');
      assert.strictEqual(coll2.namespace, 'other_namespace');
    });

    it('should should not throw an error when getting namespace if namespace is set later', () => {
      const db = mkDb({ ...internalOps(), environment: 'dse' }, TEST_APPLICATION_URI, {}, null);
      assert.throws(() => db.namespace);
      db.useNamespace('other_namespace');
      assert.strictEqual(db.namespace, 'other_namespace');
    });
  });

  describe('admin tests', () => {
    it('should accept matching environments', () => {
      assert.doesNotThrow(() => {
        const db = new DataAPIClient('dummy_token').db(DEMO_APPLICATION_URI);
        db.admin();
      });
      assert.doesNotThrow(() => {
        const db = new DataAPIClient('dummy_token', { environment: 'dse' }).db(DEMO_APPLICATION_URI);
        db.admin({ environment: 'dse' });
      });
      assert.doesNotThrow(() => {
        const db = new DataAPIClient('dummy_token', { environment: 'other' }).db(DEMO_APPLICATION_URI);
        db.admin({ environment: 'other' });
      });
    });

    it('should throw on mismatching environments', () => {
      assert.throws(() => {
        const db = new DataAPIClient('dummy_token').db(DEMO_APPLICATION_URI);
        db.admin({ environment: 'dse' });
      }, { message: 'Mismatching environment—environment option is not the same as set in the DataAPIClient' });
      assert.throws(() => {
        const db = new DataAPIClient('dummy_token', { environment: 'dse' }).db(DEMO_APPLICATION_URI);
        db.admin();
      }, { message: 'Mismatching environment—environment option is not the same as set in the DataAPIClient' });
      assert.throws(() => {
        const db = new DataAPIClient('dummy_token', { environment: 'dse' }).db(DEMO_APPLICATION_URI);
        db.admin({ environment: 'hcd' });
      }, { message: 'Mismatching environment—environment option is not the same as set in the DataAPIClient' });
    });

    it('should return the admin if on astra db', () => {
      const db = mkDb(internalOps(), 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb', 'us-east1', null);
      assert.strictEqual(db.admin().id, 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb');
    });
  });
});
