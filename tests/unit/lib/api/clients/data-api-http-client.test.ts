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
import { describe, it } from '@/tests/testlib/index.js';
import { DataAPIClient } from '@/src/client/index.js';
import type { Fetcher, FetcherRequestInfo, FetcherResponseInfo } from '@/src/lib/api/fetch/fetcher.js';

describe('unit.lib.api.clients.data-api-http-client', () => {
  interface RecordingFetcher extends Fetcher {
    lastUrl?: string;
  }

  // NB: `HttpOptsHandler` decodes the `fetcher` option through `inexact({ fetch, close })`, which pulls the
  // `fetch`/`close` functions out into a fresh plain object—so a class relying on `this` would silently record
  // onto the wrong object. Using a closure-captured mutable record avoids that trap.
  function mkRecordingFetcher(): RecordingFetcher {
    const state: { lastUrl?: string } = {};

    return {
      get lastUrl() {
        return state.lastUrl;
      },
      async fetch(info: FetcherRequestInfo): Promise<FetcherResponseInfo> {
        state.lastUrl = info.url;

        return {
          headers: {},
          status: 200,
          httpVersion: 1,
          url: info.url,
          statusText: 'OK',
          body: JSON.stringify({ status: { insertedIds: ['1'] } }),
        };
      },
    };
  }

  const mkDb = (fetcher: RecordingFetcher) => {
    const client = new DataAPIClient('dummy-token', {
      httpOptions: { client: 'custom', fetcher },
      environment: 'other',
    });
    return client.db('http://localhost:8181', { keyspace: 'default_keyspace' });
  };

  describe('executeCommand', () => {
    it('should URL-encode a collection name containing special characters', async () => {
      const fetcher = mkRecordingFetcher();
      const db = mkDb(fetcher);

      const collectionName = 'my col#lection?x=1&y=2';

      try {
        await db.collection(collectionName).insertOne({ name: 'John' });
      } catch {
        // Response is faked and not meant to satisfy the full insertOne() contract; we only care about the URL.
      }

      assert.ok(fetcher.lastUrl, 'expected a request to have been made');
      assert.ok(!fetcher.lastUrl.includes(collectionName), 'raw, unencoded collection name leaked into the URL');
      assert.strictEqual(fetcher.lastUrl, `http://localhost:8181/v1/default_keyspace/${encodeURIComponent(collectionName)}`);
    });

    it('should URL-encode a table name containing special characters', async () => {
      const fetcher = mkRecordingFetcher();
      const db = mkDb(fetcher);

      const tableName = 'my table/name?a=b';

      try {
        await db.table(tableName).insertOne({ name: 'John' } as never);
      } catch {
        // Response is faked and not meant to satisfy the full insertOne() contract; we only care about the URL.
      }

      assert.ok(fetcher.lastUrl, 'expected a request to have been made');
      assert.ok(!fetcher.lastUrl.includes(tableName), 'raw, unencoded table name leaked into the URL');
      assert.strictEqual(fetcher.lastUrl, `http://localhost:8181/v1/default_keyspace/${encodeURIComponent(tableName)}`);
    });

    it('should leave plain alphanumeric collection/table names unchanged', async () => {
      const fetcher = mkRecordingFetcher();
      const db = mkDb(fetcher);

      await db.collection('plain_collection').insertOne({ name: 'John' });

      assert.strictEqual(fetcher.lastUrl, 'http://localhost:8181/v1/default_keyspace/plain_collection');
    });
  });
});
