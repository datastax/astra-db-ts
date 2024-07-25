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

import { DataAPIResponseError } from '@/src/data-api';
import { initTestObjects } from '@/tests/fixtures';
import { DataAPIHttpClient } from '@/src/api';
import { describe, it } from '@/tests/test-utils';
import assert from 'assert';
import { DEFAULT_COLLECTION_NAME, OTHER_NAMESPACE, TEST_APPLICATION_URI } from '@/tests/config';

describe('integration.api.data-api-http-client', ({ db }) => {
  let httpClient: DataAPIHttpClient;

  before(async () => {
    httpClient = db['_httpClient'];
  });

  describe('executeCommand tests', () => {
    it('should execute a db-level command', async () => {
      const resp = await httpClient.executeCommand({
        findCollections: {},
      }, {});
      assert.strictEqual(typeof resp.status?.collections.length, 'number');
    });

    it('should execute a db-level command in another namespace', async () => {
      const resp = await httpClient.executeCommand({
        findCollections: {},
      }, {
        namespace: OTHER_NAMESPACE,
      });
      assert.strictEqual(resp.status?.collections.length, 1);
    });

    it('should execute a collection-level command', async () => {
      const resp = await httpClient.executeCommand({
        insertOne: { document: { name: 'John' } }
      }, {
        collection: DEFAULT_COLLECTION_NAME,
      });
      assert.ok(resp.status?.insertedIds[0]);
    });

    it('should error on invalid token', async () => {
      const { client } = initTestObjects();
      const httpClient = client.db(TEST_APPLICATION_URI, { token: 'invalid-token' })['_httpClient'];

      try {
        await httpClient.executeCommand({ findCollections: {} }, {});
        assert.fail('Expected error');
      } catch (e) {
        assert.ok(e instanceof DataAPIResponseError);
        assert.strictEqual(e.errorDescriptors.length, 1);
        assert.strictEqual(e.detailedErrorDescriptors.length, 1);
        assert.strictEqual(e.errorDescriptors[0].errorCode, 'UNAUTHENTICATED_REQUEST');
      }
    });
  });
});
