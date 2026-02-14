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

import { DataAPIClient } from '@/src/client/index.js';
import { DEFAULT_KEYSPACE, FetchNative } from '@/src/lib/api/index.js';
import assert from 'assert';
import { Cfg, describe, it, parallel } from '@/tests/testlib/index.js';
import type { Ref } from '@/src/lib/types.js';
import { HeadersProvider, StaticTokenProvider, TokenProvider, UsernamePasswordTokenProvider } from '@/src/lib/index.js';
import { DEFAULT_DATA_API_AUTH_HEADER, DEFAULT_DEVOPS_API_AUTH_HEADER } from '@/src/lib/api/constants.js';

parallel('integration.misc.headers', () => {
  const fetchNative = new FetchNative();

  const mkClient = (latestHeaders: Ref<Record<string, string | undefined>>, tp?: string | TokenProvider) => new DataAPIClient(tp, {
    environment: Cfg.DbEnvironment,
    httpOptions: {
      client: 'custom',
      fetcher: {
        fetch(info) {
          latestHeaders.ref = info.headers;
          return fetchNative.fetch(info);
        },
      },
    },
    dbOptions: {
      keyspace: DEFAULT_KEYSPACE,
    },
  });

  class AsyncTokenProvider extends TokenProvider {
    tp = new StaticTokenProvider(Cfg.DbToken);

    async getToken() {
      return this.tp.getToken();
    }
  }

  class AsyncEmbeddingHeadersProvider extends HeadersProvider<'embedding'> {
    async getHeaders() {
      return { 'x-my-custom-header': 'drain of incarnation' } as const;
    }
  }

  class CyclingTokenProvider extends TokenProvider {
    i = 0;
    tokens = ['tree', 'of', 'ages'];

    getToken() {
      return this.tokens[this.i++];
    }
  }

  class CyclingEmbeddingHeadersProvider extends HeadersProvider<'embedding'> {
    i = 0;
    tokens = ['tree', 'of', 'ages'];

    getHeaders() {
      return { 'x-my-custom-header': this.tokens[this.i++] };
    }
  }

  describe('token providers', () => {
    it('(ASTRA) should call the provider on a per-call basis to the Data API', async () => {
      const latestHeaders: Ref<Record<string, string>> = { ref: {} };
      const client = mkClient(latestHeaders);
      const db = client.db(Cfg.DbUrl, { token: new CyclingTokenProvider() });
      const collection = db.collection(Cfg.DefaultCollectionName);

      await assert.rejects(() => collection.findOne({}));
      assert.strictEqual(latestHeaders.ref[DEFAULT_DATA_API_AUTH_HEADER], 'tree');

      await assert.rejects(() => collection.findOne({}));
      assert.strictEqual(latestHeaders.ref[DEFAULT_DATA_API_AUTH_HEADER], 'of');

      await assert.rejects(() => collection.findOne({}));
      assert.strictEqual(latestHeaders.ref[DEFAULT_DATA_API_AUTH_HEADER], 'ages');
    });

    it('should work with an async provider', async () => {
      const latestHeaders: Ref<Record<string, string>> = { ref: {} };
      const client = mkClient(latestHeaders);
      const db = client.db(Cfg.DbUrl, { token: new AsyncTokenProvider() });
      const collection = db.collection(Cfg.DefaultCollectionName);
      await collection.findOne({});
      assert.strictEqual(latestHeaders.ref[DEFAULT_DATA_API_AUTH_HEADER], Cfg.DbToken);
    });

    it('(ASTRA) should call the provider on a per-call basis to the DevOps API', async () => {
      const latestHeaders: Ref<Record<string, string>> = { ref: {} };
      const client = mkClient(latestHeaders);
      const db = client.db(Cfg.DbUrl, { token: new CyclingTokenProvider() });
      const dbAdmin = db.admin();

      await assert.rejects(() => dbAdmin.listKeyspaces());
      assert.strictEqual(latestHeaders.ref[DEFAULT_DEVOPS_API_AUTH_HEADER], 'Bearer tree');

      await assert.rejects(() => dbAdmin.listKeyspaces());
      assert.strictEqual(latestHeaders.ref[DEFAULT_DEVOPS_API_AUTH_HEADER], 'Bearer of');


      await assert.rejects(() => dbAdmin.listKeyspaces());
      assert.strictEqual(latestHeaders.ref[DEFAULT_DEVOPS_API_AUTH_HEADER], 'Bearer ages');
    });

    it('(ASTRA) should properly set/override tokens throughout the hierarchy', async () => {
      const latestHeaders: Ref<Record<string, string>> = { ref: {} };
      const client = mkClient(latestHeaders, Cfg.DbToken);

      const db1 = client.db(Cfg.DbUrl);
      const coll1 = db1.collection(Cfg.DefaultCollectionName);
      await coll1.findOne({});
      assert.strictEqual(latestHeaders.ref[DEFAULT_DATA_API_AUTH_HEADER], Cfg.DbToken);

      const tp = new UsernamePasswordTokenProvider('cadence of', 'her last breath');
      const db2 = client.db(Cfg.DbUrl, { token: tp });
      const coll2 = db2.collection(Cfg.DefaultCollectionName);
      await assert.rejects(() => coll2.findOne({}));
      assert.strictEqual(latestHeaders.ref[DEFAULT_DATA_API_AUTH_HEADER], tp.getToken());

      const badTokenProvider = new class extends TokenProvider {
        getToken() { return 'are we we are'; }
      };

      const dbAdmin1 = db1.admin();
      const keyspaces = await dbAdmin1.listKeyspaces();
      assert.ok(Array.isArray(keyspaces));
      assert.strictEqual(latestHeaders.ref[DEFAULT_DEVOPS_API_AUTH_HEADER], `Bearer ${Cfg.DbToken}`);

      const dbAdmin2 = db1.admin({ adminToken: badTokenProvider });
      await assert.rejects(() => dbAdmin2.listKeyspaces());
      assert.strictEqual(latestHeaders.ref[DEFAULT_DEVOPS_API_AUTH_HEADER], `Bearer ${badTokenProvider.getToken()}`);
    });
  });

  describe('embedding header providers', () => {
    it('should call the provider on a per-call basis to the Data API', async () => {
      const latestHeaders: Ref<Record<string, string>> = { ref: {} };
      const client = mkClient(latestHeaders);
      const db = client.db(Cfg.DbUrl, { token: Cfg.DbToken });
      const collection = db.collection(Cfg.DefaultCollectionName, { embeddingApiKey: new CyclingEmbeddingHeadersProvider() });

      await collection.findOne({});
      assert.strictEqual(latestHeaders.ref['x-my-custom-header'], 'tree');

      await collection.findOne({});
      assert.strictEqual(latestHeaders.ref['x-my-custom-header'], 'of');

      await collection.findOne({});
      assert.strictEqual(latestHeaders.ref['x-my-custom-header'], 'ages');
    });

    it('should work with an async provider', async () => {
      const ehp = new AsyncEmbeddingHeadersProvider();
      const latestHeaders: Ref<Record<string, string>> = { ref: {} };
      const client = mkClient(latestHeaders);
      const db = client.db(Cfg.DbUrl, { token: Cfg.DbToken });
      const collection = db.collection(Cfg.DefaultCollectionName, { embeddingApiKey: ehp });
      await collection.findOne({});
      assert.strictEqual(latestHeaders.ref['x-my-custom-header'], (await ehp.getHeaders())['x-my-custom-header']);
    });
  });
});
