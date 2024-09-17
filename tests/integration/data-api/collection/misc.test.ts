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

import { DataAPITimeoutError } from '@/src/data-api';
import { DEFAULT_KEYSPACE } from '@/src/api';
import { CollectionNotFoundError } from '@/src/data-api/errors';
import { DEFAULT_COLLECTION_NAME, initTestObjects, it, parallel } from '@/tests/testlib';
import assert from 'assert';

parallel('integration.data-api.collection.misc', ({ db }) => {
  it('times out on http2', async () => {
    const { db: newDb } = initTestObjects({ httpClient: 'default:http2' });

    try {
      await newDb.collection(DEFAULT_COLLECTION_NAME).insertOne({ username: 'test' }, { maxTimeMS: 10 });
    } catch (e) {
      assert.ok(e instanceof DataAPITimeoutError);
      assert.strictEqual(e.message, 'Command timed out after 10ms');
    }
  });

  it('times out on http1', async () => {
    const { db: newDb } = initTestObjects({ httpClient: 'default:http1' });

    try {
      await newDb.collection(DEFAULT_COLLECTION_NAME).insertOne({ username: 'test' }, { maxTimeMS: 10 });
    } catch (e) {
      assert.ok(e instanceof DataAPITimeoutError);
      assert.strictEqual(e.message, 'Command timed out after 10ms');
    }
  });

  it('CollectionNotFoundError is thrown when doing data api operation on non-existent collection', async () => {
    const collection = db.collection('non_existent_collection');

    try {
      await collection.insertOne({ username: 'test' });
    } catch (e) {
      assert.ok(e instanceof CollectionNotFoundError);
      assert.strictEqual(e.keyspace, DEFAULT_KEYSPACE);
      assert.strictEqual(e.collectionName, 'non_existent_collection');
    }
  });

  it('CollectionNotFoundError is thrown when doing .options() on non-existent collection', async () => {
    const collection = db.collection('non_existent_collection');

    try {
      await collection.options();
    } catch (e) {
      assert.ok(e instanceof CollectionNotFoundError);
      assert.strictEqual(e.keyspace, DEFAULT_KEYSPACE);
      assert.strictEqual(e.collectionName, 'non_existent_collection');
    }
  });
});
