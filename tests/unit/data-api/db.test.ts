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

describe('unit.data-api.db tests', () => {
  describe('constructor tests', () => {
    it('should allow db construction from endpoint', () => {
      const db = new Db('https://id-region.apps.astra.datastax.com', { token: 'dummy' });
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, 'https://id-region.apps.astra.datastax.com/api/json/v1');
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'dummy');
    });

    it('should allow db construction from id + region', () => {
      const db = new Db('id', 'region', { token: 'dummy' });
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, 'https://id-region.apps.astra.datastax.com/api/json/v1');
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'dummy');
    });
  });

  describe('mkDb tests', () => {
    it('should allow db construction from endpoint, using default options', () => {
      const db = mkDb('original', {}, 'https://id-region.apps.astra.datastax.com');
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, 'https://id-region.apps.astra.datastax.com/api/json/v1');
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'original');
    });

    it('should allow db construction from id + region, using default options', () => {
      const db = mkDb('original', {}, 'id', 'region');
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, 'https://id-region.apps.astra.datastax.com/api/json/v1');
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'original');
    });

    it('should allow db construction from endpoint, overwriting options', () => {
      const db = mkDb('original', { dataApiPath: 'old' }, 'https://id-region.apps.astra.datastax.com', { dataApiPath: 'new', token: 'new' });
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, 'https://id-region.apps.astra.datastax.com/new');
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'new');
    });

    it('should allow db construction from id + region, overwriting options', () => {
      const db = mkDb('original', { dataApiPath: 'old' }, 'id', 'region', { dataApiPath: 'new', token: 'new' });
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, 'https://id-region.apps.astra.datastax.com/new');
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'new');
    });

    it('is initialized with default namespace', () => {
      const db = mkDb('dummy-token', {}, process.env.ASTRA_URI!);
      assert.strictEqual(db.namespace, 'default_keyspace');
    });

    it('overrides namespace in db when provided', () => {
      const db = mkDb('dummy-token', {}, process.env.ASTRA_URI!, { namespace: 'new_namespace' });
      assert.strictEqual(db.namespace, 'new_namespace');
    });

    it('throws error on empty namespace', () => {
      assert.throws(() => {
        mkDb('dummy-token', {}, process.env.ASTRA_URI!, { namespace: '' });
      });
    });

    it('throws error on invalid namespace', () => {
      assert.throws(() => {
        mkDb('dummy-token', {}, process.env.ASTRA_URI!, { namespace: 'bad namespace' });
      });
    });

    it('uses http2 by default', () => {
      const db = mkDb('dummy-token', {}, process.env.ASTRA_URI!);
      assert.ok(db['_httpClient'].isUsingHttp2());
    });

    it('uses http2 when forced', () => {
      const db = mkDb('dummy-token', {}, process.env.ASTRA_URI!, { useHttp2: true });
      assert.ok(db['_httpClient'].isUsingHttp2());
    });

    it('uses http1.1 when forced', () => {
      const db = mkDb('dummy-token', {}, process.env.ASTRA_URI!, { useHttp2: false });
      assert.ok(!db['_httpClient'].isUsingHttp2());
    });

    it('uses http1.1 if overridden', () => {
      const db = mkDb('dummy-token', { useHttp2: true }, process.env.ASTRA_URI!, { useHttp2: false });
      assert.ok(!db['_httpClient'].isUsingHttp2());
    });

    it('uses http2 if overridden', () => {
      const db = mkDb('dummy-token', { useHttp2: false }, process.env.ASTRA_URI!, { useHttp2: true });
      assert.ok(db['_httpClient'].isUsingHttp2());
    });

    it('handles different dataApiPath', () => {
      const db = mkDb('dummy-token', { dataApiPath: 'api/json/v2' }, process.env.ASTRA_URI!);
      assert.strictEqual(db['_httpClient'].baseUrl, `${process.env.ASTRA_URI}/api/json/v2`);
    });

    it('handles different dataApiPath when overridden', () => {
      const db = mkDb('dummy-token', { dataApiPath: 'api/json/v2' }, process.env.ASTRA_URI!, { dataApiPath: 'api/json/v3' });
      assert.strictEqual(db['_httpClient'].baseUrl, `${process.env.ASTRA_URI}/api/json/v3`);
    });

    it('overrides token in db when provided', () => {
      const db = mkDb('old', {}, process.env.ASTRA_URI!, { token: 'new' });
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'new');
    });
  });
});
