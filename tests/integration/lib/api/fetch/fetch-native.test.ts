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

import { Cfg, DemoAstraEndpoint, it, parallel } from '@/tests/testlib/index.js';
import { DEFAULT_KEYSPACE, FetchNative } from '@/src/lib/api/index.js';
import assert from 'assert';
import { DEFAULT_DATA_API_PATHS } from '@/src/lib/api/constants.js';

parallel('integration.lib.api.fetch.fetch-native', () => {
  const genericOptions = <const>{
    url: `${Cfg.DbUrl}/${DEFAULT_DATA_API_PATHS[Cfg.DbEnvironment]}/${DEFAULT_KEYSPACE}`,
    method: 'POST',
    body: JSON.stringify({ findCollections: {} }),
    headers: { Token: Cfg.DbToken, 'Content-Type': 'application/json' },
    timeout: 10000,
    mkTimeoutError: () => { throw new Error('timeout'); },
    forceHttp1: false,
  };

  it('should work', async () => {
    const fetcher = new FetchNative();
    const resp = await fetcher.fetch(genericOptions);
    assert.strictEqual(resp.url, genericOptions.url);
    assert.strictEqual(typeof JSON.parse(resp.body!)?.status, 'object');
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(resp.statusText, 'OK');
    assert.strictEqual(resp.httpVersion, 1);
    assert.strictEqual(typeof resp.headers, 'object');
    assert.strictEqual(resp.extraLogInfo, undefined);
  });

  it('should throw custom timeout error on timeout', async () => {
    try {
      const fetcher = new FetchNative();
      await fetcher.fetch({ ...genericOptions, timeout: 1 });
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.strictEqual(e.message, 'timeout');
    }
  });

  it('should rethrow underlying error if not a timeout', async () => {
    try {
      const fetcher = new FetchNative();
      // @ts-expect-error - Testing invalid input
      await fetcher.fetch(2);
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof TypeError);
    }
  });

  it('should rethrow underlying error if not a timeout, even if TypeError: fetch failed', async () => {
    try {
      const fetcher = new FetchNative();
      await fetcher.fetch({ ...genericOptions, url: DemoAstraEndpoint });
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.ok('code' in e);
      assert.strictEqual(e.code, 'ENOTFOUND');
    }
  });
});
