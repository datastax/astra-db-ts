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

import { DEMO_APPLICATION_URI, it, parallel, TEST_APPLICATION_TOKEN, TEST_APPLICATION_URI } from '@/tests/testlib';
import { DEFAULT_NAMESPACE, FetchH2 } from '@/src/api';
import assert from 'assert';

parallel('integration.api.fetch.fetch-h2', () => {
  const genericOptions = <const>{
    url: `${TEST_APPLICATION_URI}/api/json/v1/${DEFAULT_NAMESPACE}`,
    method: 'POST',
    body: JSON.stringify({ findCollections: {} }),
    headers: { Token: TEST_APPLICATION_TOKEN },
    timeout: 10000,
    mkTimeoutError: () => { throw new Error('timeout'); },
    forceHttp1: false,
  };

  it('should work with http1', async () => {
    const fetcher = new FetchH2({}, false);
    try {
      const resp = await fetcher.fetch(genericOptions);
      assert.strictEqual(resp.url, genericOptions.url);
      assert.strictEqual(typeof JSON.parse(resp.body!)?.status, 'object');
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.statusText, 'OK');
      assert.strictEqual(resp.httpVersion, 1);
      assert.strictEqual(typeof resp.headers, 'object');
      assert.strictEqual(resp.additionalAttributes, undefined);
    } finally {
      await fetcher.close();
    }
  });

  it('should work with http2', async () => {
    const fetcher = new FetchH2({}, true);
    try {
      const resp = await fetcher.fetch(genericOptions);
      assert.strictEqual(resp.url, genericOptions.url);
      assert.strictEqual(typeof JSON.parse(resp.body!)?.status, 'object');
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.statusText, '');
      assert.strictEqual(resp.httpVersion, 2);
      assert.strictEqual(typeof resp.headers, 'object');
      assert.strictEqual(resp.additionalAttributes, undefined);
    } finally {
      await fetcher.close();
    }
  });

  it('should throw custom timeout error on timeout', async () => {
    const fetcher = new FetchH2({}, true);
    try {
      await fetcher.fetch({ ...genericOptions, timeout: 0 });
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.strictEqual(e.message, 'timeout');
    } finally {
      await fetcher.close();
    }
  });

  it('should rethrow underlying error if not a timeout', async () => {
    const fetcher = new FetchH2({}, true);
    try {
      await fetcher.fetch({ ...genericOptions, url: DEMO_APPLICATION_URI });
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.ok('code' in e);
      assert.strictEqual(e.code, 'ENOTFOUND');
    } finally {
      await fetcher.close();
    }
  });
});
