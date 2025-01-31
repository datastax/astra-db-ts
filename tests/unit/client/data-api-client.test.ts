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
import { FetcherResponseInfo } from '@/src/lib/api';
import { FetchH2 } from '@/src/lib/api/fetch/fetch-h2';
import { FetcherRequestInfo } from '@/src/lib/api/fetch/types';
import { UsernamePasswordTokenProvider } from '@/src/lib';
import { describe, it, TEST_APPLICATION_URI } from '@/tests/testlib';
import assert from 'assert';
import { $CustomInspect, DataAPIEnvironments } from '@/src/lib/constants';
import { InvalidEnvironmentError } from '@/src/db';

describe('unit.client.data-api-client', () => {
  it('should accept valid tokens', () => {
    assert.doesNotThrow(() => new DataAPIClient());
    assert.doesNotThrow(() => new DataAPIClient('token'));
    assert.doesNotThrow(() => new DataAPIClient(new UsernamePasswordTokenProvider('username', 'password')));
  });

  it('should throw if an invalid token is passed', () => {
    // @ts-expect-error - testing invalid input
    assert.throws(() => new DataAPIClient(3));
    // @ts-expect-error - testing invalid input
    assert.throws(() => new DataAPIClient({ logLevel: 'warn' }, {}));
  });

  it('should accept null/undefined/{} for options', () => {
    assert.doesNotThrow(() => new DataAPIClient('dummy-token', null));
    assert.doesNotThrow(() => new DataAPIClient('dummy-token', undefined));
    assert.doesNotThrow(() => new DataAPIClient('dummy-token', {}));
  });

  it('should accept valid environments', () => {
    assert.doesNotThrow(() => new DataAPIClient('dummy-token', { environment: undefined }));

    for (const environment of DataAPIEnvironments) {
      assert.doesNotThrow(() => new DataAPIClient('dummy-token', { environment }));
    }
  });

  it('should throw on invalid environments', () => {
    // @ts-expect-error - testing invalid input
    assert.throws(() => new DataAPIClient('dummy-token', { environment: null }));
    // @ts-expect-error - testing invalid input
    assert.throws(() => new DataAPIClient('dummy-token', { environment: [] }));
    // @ts-expect-error - testing invalid input
    assert.throws(() => new DataAPIClient('dummy-token', { environment: 'asdasd' }));
    // @ts-expect-error - testing invalid input
    assert.throws(() => new DataAPIClient('dummy-token', { environment: 32 }));
    // @ts-expect-error - testing invalid input
    assert.throws(() => new DataAPIClient('dummy-token', { environment: 'DSE' }));
  });

  it('should accept valid callers', () => {
    assert.doesNotThrow(() => new DataAPIClient('dummy-token', { caller: undefined }));
    assert.doesNotThrow(() => new DataAPIClient('dummy-token', { caller: [] }));
    assert.doesNotThrow(() => new DataAPIClient('dummy-token', { caller: ['a', 'b'] }));
    assert.doesNotThrow(() => new DataAPIClient('dummy-token', { caller: [['a', 'b'], ['c', 'd']] }));
  });

  it('should throw on invalid callers', () => {
    // @ts-expect-error - null technically allowed
    assert.throws(() => new DataAPIClient('dummy-token', { caller: null }));
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
    assert.doesNotThrow(() => new DataAPIClient('dummy-token', { httpOptions: { client: 'fetch-h2' } }));
    assert.doesNotThrow(() => new DataAPIClient('dummy-token', { httpOptions: { client: 'fetch' } }));
    // @ts-expect-error - testing invalid input
    assert.throws(() => new DataAPIClient('dummy-token', { httpOptions: {} }));
    // @ts-expect-error - testing invalid input
    assert.throws(() => new DataAPIClient('dummy-token', { httpOptions: { client: 'default' } }));
    // @ts-expect-error - testing invalid input
    assert.throws(() => new DataAPIClient('dummy-token', { httpOptions: { client: 'archspire' } }));
    // @ts-expect-error - testing invalid input
    assert.throws(() => new DataAPIClient('dummy-token', { httpOptions: { client: 12312312312 } }));
  });

  it('validates options properly', () => {
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

  it('should throw on .admin() if invalid env', () => {
    for (const env of DataAPIEnvironments.filter(e => e !== 'astra')) {
      const client = new DataAPIClient('dummy-token', { environment: env });
      assert.throws(() => client.admin(), InvalidEnvironmentError);
    }
  });

  it('should inspect', () => {
    for (const env of [...DataAPIEnvironments, undefined]) {
      const client = new DataAPIClient('dummy-token', { environment: env });
      assert.strictEqual((client as any)[$CustomInspect](), `DataAPIClient(env="${env ?? 'astra'}")`);
    }
  });

  describe('using fetch-h2', () => {
    it('uses http2 by default', function () {
      const client = new DataAPIClient('dummy-token', { httpOptions: { client: 'fetch-h2' } });
      const httpClient = client.db(TEST_APPLICATION_URI)._httpClient;
      assert.ok(httpClient.fetchCtx.ctx instanceof FetchH2);
      assert.ok(httpClient.fetchCtx.ctx['_http1'] !== httpClient.fetchCtx.ctx['_preferred']);
    });

    it('uses http2 when forced', function () {
      const client = new DataAPIClient('dummy-token', { httpOptions: { client: 'fetch-h2', preferHttp2: true } });
      const httpClient = client.db(TEST_APPLICATION_URI)._httpClient;
      assert.ok(httpClient.fetchCtx.ctx instanceof FetchH2);
      assert.ok(httpClient.fetchCtx.ctx['_http1'] !== httpClient.fetchCtx.ctx['_preferred']);
    });

    it('uses http1.1 when forced', () => {
      const client = new DataAPIClient('dummy-token', { httpOptions: { client: 'fetch-h2', preferHttp2: false } });
      const httpClient = client.db(TEST_APPLICATION_URI)._httpClient;
      assert.ok(httpClient.fetchCtx.ctx instanceof FetchH2);
      assert.ok(httpClient.fetchCtx.ctx['_http1'] === httpClient.fetchCtx.ctx['_preferred']);
    });
  });

  describe('using custom http client', () => {
    it('should allow custom http client', async () => {
      class CustomFetcher {
        async fetch(_: FetcherRequestInfo): Promise<FetcherResponseInfo> {
          return 3 as any;
        }
      }

      const client = new DataAPIClient('dummy-token', {
        httpOptions: { client: 'custom', fetcher: new CustomFetcher() },
      });

      const httpClient = client.db(TEST_APPLICATION_URI)._httpClient;
      assert.strictEqual(await httpClient.fetchCtx.ctx.fetch(null!), 3);
      assert.strictEqual(httpClient.fetchCtx.ctx.close, undefined);
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
});
