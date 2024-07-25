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

import { DEFAULT_COLLECTION_NAME, ENVIRONMENT, TEST_APPLICATION_TOKEN, TEST_APPLICATION_URI } from '@/tests/fixtures';
import { DataAPITimeoutError } from '@/src/data-api';
import { DEFAULT_NAMESPACE, HttpMethods } from '@/src/api';
import { DevOpsAPITimeoutError } from '@/src/devops';
import { DataAPIClient } from '@/src/client';
import { describe, it } from '@/tests/test-utils';
import assert from 'assert';

describe('integration.misc.timeouts', ({ db, collection }) => {
  describe('in data-api', () => {
    it('should timeout @ the http-client level', async () => {
      const httpClient = collection['_httpClient'];

      await assert.rejects(async () => {
        await httpClient.executeCommand({ insertOne: { document: {} } }, { maxTimeMS: 5 });
      }, DataAPITimeoutError);
    });

    it('should timeout based on DataAPIClient maxTimeMS', async () => {
      const collection = new DataAPIClient(TEST_APPLICATION_TOKEN, { httpOptions: { maxTimeMS: 1 }, environment: ENVIRONMENT })
        .db(TEST_APPLICATION_URI, { namespace: DEFAULT_NAMESPACE })
        .collection(DEFAULT_COLLECTION_NAME);

      await assert.rejects(async () => {
        await collection.insertOne({ name: 'Nightwish' });
      }, DataAPITimeoutError);
    });

    it('should timeout based on collection maxTimeMS', async () => {
      const collection = new DataAPIClient(TEST_APPLICATION_TOKEN, { httpOptions: { maxTimeMS: 30000 }, environment: ENVIRONMENT })
        .db(TEST_APPLICATION_URI, { namespace: DEFAULT_NAMESPACE })
        .collection(DEFAULT_COLLECTION_NAME, { defaultMaxTimeMS: 1 });

      await assert.rejects(async () => {
        await collection.insertOne({ name: 'Nightwish' });
      }, DataAPITimeoutError);
    });

    it('should timeout based on operation maxTimeMS', async () => {
      const collection = new DataAPIClient(TEST_APPLICATION_TOKEN, { httpOptions: { maxTimeMS: 30000 }, environment: ENVIRONMENT })
        .db(TEST_APPLICATION_URI, { namespace: DEFAULT_NAMESPACE })
        .collection(DEFAULT_COLLECTION_NAME, { defaultMaxTimeMS: 30000 });

      await assert.rejects(async () => {
        await collection.insertOne({ name: 'Nightwish' }, { maxTimeMS: 1 });
      }, DataAPITimeoutError);
    });
  });

  describe('[astra] in devops', () => {
    it('should timeout @ the http-client level', async () => {
      const httpClient = db.admin()['_httpClient'];

      await assert.rejects(async () => {
        await httpClient.request({ method: HttpMethods.Get, path: '/databases' }, { maxTimeMS: 5 });
      }, DevOpsAPITimeoutError);
    });

    it('should timeout based on DataAPIClient maxTimeMS', async () => {
      const admin = new DataAPIClient(TEST_APPLICATION_TOKEN, { httpOptions: { maxTimeMS: 1 }, environment: ENVIRONMENT })
        .db(TEST_APPLICATION_URI)
        .admin();

      await assert.rejects(async () => {
        await admin.listNamespaces();
      }, DevOpsAPITimeoutError);
    });

    it('should timeout based on operation maxTimeMS', async () => {
      const admin = new DataAPIClient(TEST_APPLICATION_TOKEN, { httpOptions: { maxTimeMS: 30000 }, environment: ENVIRONMENT })
        .db(TEST_APPLICATION_URI)
        .admin();

      await assert.rejects(async () => {
        await admin.listNamespaces({ maxTimeMS: 1 });
      }, DevOpsAPITimeoutError);
    });
  });
});
