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

import { DataAPIClient } from '@/src/client';
import {
  DEFAULT_DATA_API_AUTH_HEADER,
  DEFAULT_DEVOPS_API_AUTH_HEADER,
  DEFAULT_NAMESPACE,
  FetchNative,
} from '@/src/api';
import { nullish, Ref, StaticTokenProvider, TokenProvider, UsernamePasswordTokenProvider } from '@/src/common';
import assert from 'assert';
import { EmbeddingHeadersProvider } from '@/src/data-api';
import {
  DEFAULT_COLLECTION_NAME,
  ENVIRONMENT,
  it,
  parallel,
  describe,
  TEST_APPLICATION_TOKEN,
  TEST_APPLICATION_URI,
} from '@/tests/testlib';

parallel('integration.misc.headers', () => {
  const fetchNative = new FetchNative();

  const mkClient = (latestHeaders: Ref<Record<string, string>>, tp?: string | TokenProvider | nullish) => new DataAPIClient(tp, {
    environment: ENVIRONMENT,
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
      namespace: DEFAULT_NAMESPACE,
    },
  });

  class AsyncTokenProvider extends TokenProvider {
    tp = new StaticTokenProvider(TEST_APPLICATION_TOKEN);

    async getToken() {
      return this.tp.getToken();
    }
  }

  class AsyncEmbeddingHeadersProvider extends EmbeddingHeadersProvider {
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

  class CyclingEmbeddingHeadersProvider extends EmbeddingHeadersProvider {
    i = 0;
    tokens = ['tree', 'of', 'ages'];

    getHeaders() {
      return { 'x-my-custom-header': this.tokens[this.i++] };
    }
  }

  describe('token providers', () => {
    it('should call the provider on a per-call basis to the Data API', async () => {
      const latestHeaders: Ref<Record<string, string>> = { ref: {} };
      const client = mkClient(latestHeaders);
      const db = client.db(TEST_APPLICATION_URI, { token: new CyclingTokenProvider() });
      const collection = db.collection(DEFAULT_COLLECTION_NAME);

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
      const db = client.db(TEST_APPLICATION_URI, { token: new AsyncTokenProvider() });
      const collection = db.collection(DEFAULT_COLLECTION_NAME);
      await collection.findOne({});
      assert.strictEqual(latestHeaders.ref[DEFAULT_DATA_API_AUTH_HEADER], TEST_APPLICATION_TOKEN);
    });

    it('[ASTRA] should call the provider on a per-call basis to the DevOps API', async () => {
      const latestHeaders: Ref<Record<string, string>> = { ref: {} };
      const client = mkClient(latestHeaders);
      const db = client.db(TEST_APPLICATION_URI, { token: new CyclingTokenProvider() });
      const dbAdmin = db.admin({ environment: ENVIRONMENT as 'astra' });

      await assert.rejects(() => dbAdmin.listNamespaces());
      assert.strictEqual(latestHeaders.ref[DEFAULT_DEVOPS_API_AUTH_HEADER], 'Bearer tree');

      await assert.rejects(() => dbAdmin.listNamespaces());
      assert.strictEqual(latestHeaders.ref[DEFAULT_DEVOPS_API_AUTH_HEADER], 'Bearer of');

      await assert.rejects(() => dbAdmin.listNamespaces());
      assert.strictEqual(latestHeaders.ref[DEFAULT_DEVOPS_API_AUTH_HEADER], 'Bearer ages');
    });

    it('should properly set/override tokens throughout the hierarchy', async () => {
      const latestHeaders: Ref<Record<string, string>> = { ref: {} };
      const client = mkClient(latestHeaders, TEST_APPLICATION_TOKEN);

      const db1 = client.db(TEST_APPLICATION_URI);
      const coll1 = db1.collection(DEFAULT_COLLECTION_NAME);
      await coll1.findOne({});
      assert.strictEqual(latestHeaders.ref[DEFAULT_DATA_API_AUTH_HEADER], TEST_APPLICATION_TOKEN);

      const tp = new UsernamePasswordTokenProvider('cadence of', 'her last breath');
      const db2 = client.db(TEST_APPLICATION_URI, { token: tp });
      const coll2 = db2.collection(DEFAULT_COLLECTION_NAME);
      await assert.rejects(() => coll2.findOne({}));
      assert.strictEqual(latestHeaders.ref[DEFAULT_DATA_API_AUTH_HEADER], tp.getToken());

      const badTokenProvider = new class extends TokenProvider {
        getToken() { return 'are we we are' }
      }

      if (ENVIRONMENT === 'astra') {
        const dbAdmin1 = db1.admin({ environment: ENVIRONMENT });
        const namespaces = await dbAdmin1.listNamespaces();
        assert.ok(Array.isArray(namespaces));
        assert.strictEqual(latestHeaders.ref[DEFAULT_DEVOPS_API_AUTH_HEADER], `Bearer ${TEST_APPLICATION_TOKEN}`);

        const dbAdmin2 = db1.admin({ environment: ENVIRONMENT, adminToken: badTokenProvider });
        await assert.rejects(() => dbAdmin2.listNamespaces());
        assert.strictEqual(latestHeaders.ref[DEFAULT_DEVOPS_API_AUTH_HEADER], `Bearer ${badTokenProvider.getToken()}`);
      } else {
        const dbAdmin1 = db1.admin({ environment: ENVIRONMENT });
        const namespaces = await dbAdmin1.listNamespaces();
        assert.ok(Array.isArray(namespaces));
        assert.strictEqual(latestHeaders.ref[DEFAULT_DATA_API_AUTH_HEADER], TEST_APPLICATION_TOKEN);

        const dbAdmin2 = db1.admin({ environment: ENVIRONMENT, adminToken: badTokenProvider });
        await assert.rejects(() => dbAdmin2.listNamespaces());
        assert.strictEqual(latestHeaders.ref[DEFAULT_DATA_API_AUTH_HEADER], badTokenProvider.getToken());
      }
    });
  });

  describe('embedding header providers', () => {
    it('should call the provider on a per-call basis to the Data API', async () => {
      const latestHeaders: Ref<Record<string, string>> = { ref: {} };
      const client = mkClient(latestHeaders);
      const db = client.db(TEST_APPLICATION_URI, { token: TEST_APPLICATION_TOKEN });
      const collection = db.collection(DEFAULT_COLLECTION_NAME, { embeddingApiKey: new CyclingEmbeddingHeadersProvider() });

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
      const db = client.db(TEST_APPLICATION_URI, { token: TEST_APPLICATION_TOKEN });
      const collection = db.collection(DEFAULT_COLLECTION_NAME, { embeddingApiKey: ehp });
      await collection.findOne({});
      assert.strictEqual(latestHeaders.ref['x-my-custom-header'], (await ehp.getHeaders())['x-my-custom-header']);
    });
  });
});
