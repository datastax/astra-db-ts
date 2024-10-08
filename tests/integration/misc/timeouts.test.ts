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

import { DEFAULT_KEYSPACE } from '@/src/lib/api';
import { DevOpsAPITimeoutError } from '@/src/administration';
import { DataAPIClient } from '@/src/client';
import {
  DEFAULT_COLLECTION_NAME,
  describe,
  ENVIRONMENT,
  it,
  parallel,
  TEST_APPLICATION_TOKEN,
  TEST_APPLICATION_URI,
} from '@/tests/testlib';
import assert from 'assert';
import { DataAPITimeoutError } from '@/src/documents';
import { HttpMethods } from '@/src/lib/api/constants';

parallel('integration.misc.timeouts', ({ collection, dbAdmin }) => {
  describe('in data-api', () => {
    it('should timeout @ the http-client level', async () => {
      const httpClient = collection['_httpClient'];

      await assert.rejects(async () => {
        await httpClient.executeCommand({ findOne: { filter: {} } }, { maxTimeMS: 5 });
      }, DataAPITimeoutError);
    });

    it('should timeout @ the http-client level if timeout is negative', async () => {
      const httpClient = collection['_httpClient'];

      await assert.rejects(async () => {
        await httpClient.executeCommand({ findOne: { filter: {} } }, { maxTimeMS: -1 });
      }, DataAPITimeoutError);
    });

    it('should timeout based on DataAPIClient maxTimeMS', async () => {
      const collection = new DataAPIClient(TEST_APPLICATION_TOKEN, { httpOptions: { maxTimeMS: 1 }, environment: ENVIRONMENT })
        .db(TEST_APPLICATION_URI, { keyspace: DEFAULT_KEYSPACE })
        .collection(DEFAULT_COLLECTION_NAME);

      await assert.rejects(async () => {
        await collection.findOne({});
      }, DataAPITimeoutError);
    });

    it('should timeout based on collection maxTimeMS', async () => {
      const collection = new DataAPIClient(TEST_APPLICATION_TOKEN, { httpOptions: { maxTimeMS: 30000 }, environment: ENVIRONMENT })
        .db(TEST_APPLICATION_URI, { keyspace: DEFAULT_KEYSPACE })
        .collection(DEFAULT_COLLECTION_NAME, { defaultMaxTimeMS: 1 });

      await assert.rejects(async () => {
        await collection.findOne({});
      }, DataAPITimeoutError);
    });

    it('should timeout based on operation maxTimeMS', async () => {
      const collection = new DataAPIClient(TEST_APPLICATION_TOKEN, { httpOptions: { maxTimeMS: 30000 }, environment: ENVIRONMENT })
        .db(TEST_APPLICATION_URI, { keyspace: DEFAULT_KEYSPACE })
        .collection(DEFAULT_COLLECTION_NAME, { defaultMaxTimeMS: 30000 });

      await assert.rejects(async () => {
        await collection.findOne({}, { maxTimeMS: 1 });
      }, DataAPITimeoutError);
    });
  });

  describe('(ASTRA) in devops', () => {
    it('should timeout @ the http-client level', async () => {
      const httpClient = (<any>dbAdmin)['_httpClient'];

      await assert.rejects(async () => {
        await httpClient.request({ method: HttpMethods.Get, path: '/databases' }, { maxTimeMS: 5 });
      }, DevOpsAPITimeoutError);
    });

    it('should timeout based on DataAPIClient maxTimeMS', async () => {
      const admin = new DataAPIClient(TEST_APPLICATION_TOKEN, { httpOptions: { maxTimeMS: 1 }, environment: ENVIRONMENT })
        .db(TEST_APPLICATION_URI)
        .admin();

      await assert.rejects(async () => {
        await admin.listKeyspaces();
      }, DevOpsAPITimeoutError);
    });

    it('should timeout based on operation maxTimeMS', async () => {
      const admin = new DataAPIClient(TEST_APPLICATION_TOKEN, { httpOptions: { maxTimeMS: 30000 }, environment: ENVIRONMENT })
        .db(TEST_APPLICATION_URI)
        .admin();

      await assert.rejects(async () => {
        await admin.listKeyspaces({ maxTimeMS: 1 });
      }, DevOpsAPITimeoutError);
    });
  });
});
