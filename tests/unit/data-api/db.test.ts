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
import { Db, mkDb } from '@/src/data-api';
import process from 'process';
import { DEFAULT_DATA_API_PATH, DEFAULT_NAMESPACE } from '@/src/api';
import { AdminSpawnOptions, DbSpawnOptions } from '@/src/client';

describe('unit.data-api.db', () => {
  const mkOptions = (data?: DbSpawnOptions, devops?: AdminSpawnOptions) => {
    return { dbOptions: { token: 'old', monitorCommands: false, ...data }, adminOptions: { adminToken: 'old-admin', monitorCommands: false, ...devops }, emitter: null as any };
  }

  describe('constructor tests', () => {
    it('should allow db construction from endpoint', () => {
      const db = new Db('https://id-region.apps.astra.datastax.com', mkOptions());
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, `https://id-region.apps.astra.datastax.com/${DEFAULT_DATA_API_PATH}`);
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'old');
    });
  });

  describe('mkDb tests', () => {
    it('should allow db construction from endpoint, using default options', () => {
      const db = mkDb(mkOptions(), 'https://id-region.apps.astra.datastax.com');
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, `https://id-region.apps.astra.datastax.com/${DEFAULT_DATA_API_PATH}`);
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'old');
    });

    it('should allow db construction from id + region, using default options', () => {
      const db = mkDb(mkOptions(), 'id', 'region');
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, `https://id-region.apps.astra.datastax.com/${DEFAULT_DATA_API_PATH}`);
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'old');
    });

    it('should allow db construction from endpoint, overwriting options', () => {
      const db = mkDb(mkOptions({ dataApiPath: 'old' }), 'https://id-region.apps.astra.datastax.com', { dataApiPath: 'new', token: 'new' });
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, 'https://id-region.apps.astra.datastax.com/new');
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'new');
    });

    it('should allow db construction from id + region, overwriting options', () => {
      const db = mkDb(mkOptions({ dataApiPath: 'old' }), 'id', 'region', { dataApiPath: 'new', token: 'new' });
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, 'https://id-region.apps.astra.datastax.com/new');
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'new');
    });

    it('is initialized with default namespace', () => {
      const db = mkDb(mkOptions(), process.env.ASTRA_URI!);
      assert.strictEqual(db.namespace, DEFAULT_NAMESPACE);
    });

    it('uses custon namespace when provided', () => {
      const db = mkDb(mkOptions({ namespace: 'new_namespace' }), process.env.ASTRA_URI!);
      assert.strictEqual(db.namespace, 'new_namespace');
    });

    it('overrides namespace in db when provided', () => {
      const db = mkDb(mkOptions(), process.env.ASTRA_URI!, { namespace: 'new_namespace' });
      assert.strictEqual(db.namespace, 'new_namespace');
    });

    it('throws error on empty namespace', () => {
      assert.throws(() => {
        mkDb(mkOptions(), process.env.ASTRA_URI!, { namespace: '' });
      });
    });

    it('throws error on invalid namespace', () => {
      assert.throws(() => {
        mkDb(mkOptions(), process.env.ASTRA_URI!, { namespace: 'bad namespace' });
      });
    });

    it('uses http2 by default', () => {
      const db = mkDb(mkOptions(), process.env.ASTRA_URI!);
      assert.ok(db.httpStrategy() === 'http2');
    });

    it('uses http2 when forced', () => {
      const db = mkDb(mkOptions(), process.env.ASTRA_URI!, { useHttp2: true });
      assert.ok(db.httpStrategy() === 'http2');
    });

    it('uses http1.1 when forced', () => {
      const db = mkDb(mkOptions(), process.env.ASTRA_URI!, { useHttp2: false });
      assert.ok(db.httpStrategy() === 'http1');
    });

    it('uses http1.1 if overridden', () => {
      const db = mkDb(mkOptions({ useHttp2: true }), process.env.ASTRA_URI!, { useHttp2: false });
      assert.ok(db.httpStrategy() === 'http1');
    });

    it('uses http2 if overridden', () => {
      const db = mkDb(mkOptions({ useHttp2: false }), process.env.ASTRA_URI!, { useHttp2: true });
      assert.ok(db.httpStrategy() === 'http2');
    });

    it('handles different dataApiPath', () => {
      const db = mkDb(mkOptions({ dataApiPath: 'api/json/v2' }), process.env.ASTRA_URI!);
      assert.strictEqual(db['_httpClient'].baseUrl, `${process.env.ASTRA_URI}/api/json/v2`);
    });

    it('handles different dataApiPath when overridden', () => {
      const db = mkDb(mkOptions({ dataApiPath: 'api/json/v2' }), process.env.ASTRA_URI!, { dataApiPath: 'api/json/v3' });
      assert.strictEqual(db['_httpClient'].baseUrl, `${process.env.ASTRA_URI}/api/json/v3`);
    });

    it('overrides token in db when provided', () => {
      const db = mkDb(mkOptions(), process.env.ASTRA_URI!, { token: 'new' });
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'new');
    });
  });

  describe('http-related tests', () => {
    it('returns the correct http strategy when using http2', () => {
      const db = mkDb(mkOptions(), process.env.ASTRA_URI!);
      assert.strictEqual(db.httpStrategy(), 'http2');
    });

    it('returns the correct http strategy when using http1.1', () => {
      const db = mkDb(mkOptions({ useHttp2: false }), process.env.ASTRA_URI!);
      assert.strictEqual(db.httpStrategy(), 'http1');
    });

    it('close + isClosed works when on http2', () => {
      const db = mkDb(mkOptions(), process.env.ASTRA_URI!);
      assert.strictEqual(db.isClosed(), false);
      db.close();
      assert.strictEqual(db.isClosed(), true);
    });

    it('close + isClosed is apathetic on http1.1', () => {
      const db = mkDb(mkOptions({ useHttp2: false }), process.env.ASTRA_URI!);
      assert.strictEqual(db.isClosed(), undefined);
      db.close();
      assert.strictEqual(db.isClosed(), undefined);
    });

    it('does proper erm handling on http2', () => {
      const db = mkDb(mkOptions(), process.env.ASTRA_URI!);
      assert.strictEqual(db.isClosed(), false);
      {
        using _db = db;
      }
      assert.strictEqual(db.isClosed(), true);
    });

    it('does proper apathetic erm handling on http1.1', () => {
      const db = mkDb(mkOptions({ useHttp2: false }), process.env.ASTRA_URI!);
      assert.strictEqual(db.isClosed(), undefined);
      {
        using _db = db;
      }
      assert.strictEqual(db.isClosed(), undefined);
    });
  });

  describe('id tests', () => {
    it('should return the id from the endpoint', () => {
      const db = mkDb(mkOptions(), 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb', 'us-east1');
      assert.strictEqual(db.id, 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb');
    });

    it('should throw error if attempting to get ID for non-astra db', () => {
      const db = mkDb(mkOptions(), 'https://localhost:3000');
      assert.throws(() => { const _id = db.id });
    });
  });

  describe('admin tests', () => {
    it('should return the admin if on astra db', () => {
      const db = mkDb(mkOptions(), 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb', 'us-east1');
      assert.strictEqual(db.admin().id, 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb');
    });

    it('should throw error if attempting to get admin for non-astra db', () => {
      const db = mkDb(mkOptions(), 'https://localhost:3000');
      assert.throws(() => { const _admin = db.admin() });
    });

    it('should override auth token', () => {
      const db = mkDb(mkOptions({ token: 'old' }), 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb', 'us-east1');
      const admin = db.admin({ adminToken: 'new' });
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'old');
      assert.strictEqual(admin['_httpClient'].unsafeGetToken(), 'new');
    });
  });
});
