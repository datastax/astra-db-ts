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

import { DataAPIHttpError, DataAPIResponseError } from '@/src/data-api';
import {
  DEFAULT_COLLECTION_NAME,
  describe,
  initTestObjects,
  it,
  OTHER_KEYSPACE,
  parallel,
  TEST_APPLICATION_URI,
} from '@/tests/testlib';
import { DataAPIHttpClient } from '@/src/api';
import assert from 'assert';

describe('integration.api.clients.data-api-http-client', ({ db }) => {
  let httpClient: DataAPIHttpClient;

  before(async () => {
    httpClient = db['_httpClient'];
  });

  parallel('executeCommand tests', () => {
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
        keyspace: OTHER_KEYSPACE,
      });
      assert.strictEqual(resp.status?.collections.length, 1);
    });

    it('should execute a collection-level command', async () => {
      const resp = await httpClient.executeCommand({
        insertOne: { document: { name: 'John' } },
      }, {
        collection: DEFAULT_COLLECTION_NAME,
      });
      assert.ok(resp.status?.insertedIds[0]);
    });

    it('should error on DataAPIResponseError token', async () => {
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

    it('should throw DataAPIHttpError on invalid url', async () => {
      const { client } = initTestObjects();
      const httpClient = client.db(TEST_APPLICATION_URI + '/invalid_path')['_httpClient'];

      try {
        await httpClient.executeCommand({ findCollections: {} }, {});
        assert.fail('Expected error');
      } catch (e) {
        assert.ok(e instanceof DataAPIHttpError);
        assert.strictEqual(e.status, 404);
        assert.strictEqual(typeof e.body, 'string');
      }
    });
  });
});
