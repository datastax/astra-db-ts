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
import * as process from 'process';
import assert from 'assert';
import { DEFAULT_DATA_API_PATH, FetcherResponseInfo } from '@/src/api';
import { FetchH2 } from '@/src/api/fetch/fetch-h2';
import { FetcherRequestInfo } from '@/src/api/fetch/types';

describe('unit.client.data-api-client', () => {
  const endpoint = process.env.ASTRA_URI!;

  const idAndRegion = endpoint.split('.')[0].split('https://')[1].split('-');
  const id = idAndRegion.slice(0, 5).join('-');
  const region = idAndRegion.slice(5).join('-');

  describe('constructor tests', () => {
    it('should allow construction with just a token', () => {
      const client = new DataAPIClient('dummy-token');
      assert.ok(client);
    });

    it('should throw if no token is passed', () => {
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataAPIClient());
    });

    it('should throw if a non-string token is passed', () => {
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataAPIClient(3));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataAPIClient({ logLevel: 'warn' }));
    });

    it('should accept null/undefined/{} for options', () => {
      assert.doesNotThrow(() => new DataAPIClient('dummy-token', null));
      assert.doesNotThrow(() => new DataAPIClient('dummy-token', undefined));
      assert.doesNotThrow(() => new DataAPIClient('dummy-token', {}));
    });

    it('should accept valid callers', () => {
      // @ts-expect-error - null technically allowed
      assert.doesNotThrow(() => new DataAPIClient('dummy-token', { caller: null }));
      assert.doesNotThrow(() => new DataAPIClient('dummy-token', { caller: undefined }));
      assert.doesNotThrow(() => new DataAPIClient('dummy-token', { caller: ['a', 'b'] }));
      assert.doesNotThrow(() => new DataAPIClient('dummy-token', { caller: [['a', 'b'], ['c', 'd']] }));
    });

    it('should throw on invalid caller', () => {
      assert.throws(() => new DataAPIClient('dummy-token', { caller: [] }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataAPIClient('dummy-token', { caller: 'invalid-type' }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataAPIClient('dummy-token', { caller: [1, 'b'] }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataAPIClient('dummy-token', { caller: ['a', 2] }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataAPIClient('dummy-token', { caller: [[1]] }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataAPIClient('dummy-token', { caller: [['a', 'b', 'c']] }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataAPIClient('dummy-token', { caller: [[]] }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataAPIClient('dummy-token', { caller: [['a', 'b'], 3] }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataAPIClient('dummy-token', { caller: [{}] }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataAPIClient('dummy-token', { caller: { 0: ['name', 'version'] } }));
    });

    it('should only accept valid http client types', () => {
      assert.doesNotThrow(() => new DataAPIClient('dummy-token', { httpOptions: {} }));
      assert.doesNotThrow(() => new DataAPIClient('dummy-token', { httpOptions: { client: 'default' } }));
      assert.doesNotThrow(() => new DataAPIClient('dummy-token', { httpOptions: { client: 'fetch' } }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataAPIClient('dummy-token', { httpOptions: { client: 'archspire' } }));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataAPIClient('dummy-token', { httpOptions: { client: 12312312312 } }));
    });

    describe('using fetch-h2', () => {
      it('uses http2 by default', function () {
        const client = new DataAPIClient('dummy-token', { httpOptions: {} });
        const httpClient = client.db(endpoint)['_httpClient'];
        assert.ok(httpClient.fetchCtx.ctx instanceof FetchH2);
        assert.ok(httpClient.fetchCtx.ctx['_http1'] !== httpClient.fetchCtx.ctx['_preferred']);
      });

      it('uses http2 when forced', function () {
        const client = new DataAPIClient('dummy-token', { httpOptions: { client: 'default', preferHttp2: true } });
        const httpClient = client.db(endpoint)['_httpClient'];
        assert.ok(httpClient.fetchCtx.ctx instanceof FetchH2);
        assert.ok(httpClient.fetchCtx.ctx['_http1'] !== httpClient.fetchCtx.ctx['_preferred']);
      });

      it('uses http1.1 when forced', () => {
        const client = new DataAPIClient('dummy-token', { httpOptions: { preferHttp2: false } });
        const httpClient = client.db(endpoint)['_httpClient'];
        assert.ok(httpClient.fetchCtx.ctx instanceof FetchH2);
        assert.ok(httpClient.fetchCtx.ctx['_http1'] === httpClient.fetchCtx.ctx['_preferred']);
      });

      it('uses http2 when forced (deprecated version)', function () {
        const client = new DataAPIClient('dummy-token', { httpOptions: { client: 'default' }, preferHttp2: true });
        const httpClient = client.db(endpoint)['_httpClient'];
        assert.ok(httpClient.fetchCtx.ctx instanceof FetchH2);
        assert.ok(httpClient.fetchCtx.ctx['_http1'] !== httpClient.fetchCtx.ctx['_preferred']);
      });

      it('uses http1.1 when forced (deprecated version)', () => {
        const client = new DataAPIClient('dummy-token', { preferHttp2: false });
        const httpClient = client.db(endpoint)['_httpClient'];
        assert.ok(httpClient.fetchCtx.ctx instanceof FetchH2);
        assert.ok(httpClient.fetchCtx.ctx['_http1'] === httpClient.fetchCtx.ctx['_preferred']);
      });
    });

    describe('using custom http client', () => {
      it('should allow custom http client', () => {
        class CustomFetcher {
          async fetch(_: FetcherRequestInfo): Promise<FetcherResponseInfo> {
            return {} as FetcherResponseInfo;
          }
        }

        const client = new DataAPIClient('dummy-token', {
          httpOptions: {
            client: 'custom',
            fetcher: new CustomFetcher(),
          },
        });

        const httpClient = client.db(endpoint)['_httpClient'];
        assert.ok(httpClient.fetchCtx.ctx instanceof CustomFetcher);
      });

      it('should throw if fetcher not properly implemented', () => {
        assert.throws(() => new DataAPIClient('dummy-token', {
          httpOptions: {
            client: 'custom',
            // @ts-expect-error - testing invalid input
            fetcher: {},
          },
        }));
        assert.throws(() => new DataAPIClient('dummy-token', {
          // @ts-expect-error - testing invalid input
          httpOptions: { client: 'custom' },
        }));
      });
    });

    it('validates options properly', () => {
      assert.throws(() => new DataAPIClient('dummy-token', {
        // @ts-expect-error - testing invalid input
        httpOptions: { maxTimeMS: '3' },
      }));
      assert.throws(() => new DataAPIClient('dummy-token', {
        // @ts-expect-error - testing invalid input
        httpOptions: { preferHttp2: 3 },
      }));
      assert.throws(() => new DataAPIClient('dummy-token', {
        // @ts-expect-error - testing invalid input
        httpOptions: { http1: { maxSockets: '3' } },
      }));
      assert.throws(() => new DataAPIClient('dummy-token', {
        // @ts-expect-error - testing invalid input
        adminOptions: 3,
      }));
      assert.throws(() => new DataAPIClient('dummy-token', {
        // @ts-expect-error - testing invalid input
        dbOptions: { token: 3 },
      }));
    });
  });

  describe('db tests', () => {
    it('should allow db construction from endpoint', async () => {
      const db = new DataAPIClient('dummy-token').db(endpoint);
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, `${endpoint}/${DEFAULT_DATA_API_PATH}`);
      assert.strictEqual(await db['_httpClient'].applicationToken?.getTokenAsString(), 'dummy-token');
    });

    it('should allow db construction from id + region', async () => {
      const db = new DataAPIClient('dummy-token').db(id, region);
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, `https://${id}-${region}.apps.astra.datastax.com/${DEFAULT_DATA_API_PATH}`);
      assert.strictEqual(await db['_httpClient'].applicationToken?.getTokenAsString(), 'dummy-token');
    });

    it('should have unique http clients for each db', () => {
      const client = new DataAPIClient('dummy-token');
      const db1 = client.db(endpoint);
      const db2 = client.db(endpoint);
      assert.notStrictEqual(db1['_httpClient'], db2['_httpClient']);
    });
  });
});
