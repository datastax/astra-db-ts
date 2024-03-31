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

import { DataApiClient } from '@/src/client';
import * as process from 'process';
import assert from 'assert';
import { DEFAULT_DATA_API_PATH } from '@/src/api';
import { logger } from '@/src/logger';

describe('unit.client.data-api-client', () => {
  const endpoint = process.env.ASTRA_URI!;

  const idAndRegion = endpoint.split('.')[0].split('https://')[1].split('-');
  const id = idAndRegion.slice(0, 5).join('-');
  const region = idAndRegion.slice(5).join('-');

  describe('constructor tests', () => {
    it('should allow construction with just a token', () => {
      const client = new DataApiClient('dummy-token');
      assert.ok(client);
    });

    it('should throw if no token is passed', () => {
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataApiClient());
    });

    it('should throw if a non-string token is passed', () => {
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataApiClient(3));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new DataApiClient({ logLevel: 'warn' }));
    });

    it('should set logLevel if passed', () => {
      const client = new DataApiClient('dummy-token', { logLevel: 'silly' });
      assert.ok(client);
      assert.strictEqual(logger.transports[0].level, 'silly');
    });
  });

  describe('db tests', () => {
    it('should allow db construction from endpoint', () => {
      const db = new DataApiClient('dummy-token').db(endpoint);
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, `${endpoint}/${DEFAULT_DATA_API_PATH}`);
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'dummy-token');
    });

    it('should allow db construction from id + region', () => {
      const db = new DataApiClient('dummy-token').db(id, region);
      assert.ok(db);
      assert.strictEqual(db['_httpClient'].baseUrl, `${endpoint}/${DEFAULT_DATA_API_PATH}`);
      assert.strictEqual(db['_httpClient'].unsafeGetToken(), 'dummy-token');
    });

    it('should have unique http clients for each db', () => {
      const client = new DataApiClient('dummy-token');
      const db1 = client.db(endpoint);
      const db2 = client.db(endpoint);
      assert.notStrictEqual(db1['_httpClient'], db2['_httpClient']);
    });
  });
});
