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

import { initCollectionWithFailingClient, it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';
import { CollectionDeleteManyError, DataAPIResponseError } from '@/src/documents/index.js';

parallel('integration.documents.collections.delete-many', { truncate: 'colls:before' }, ({ collection, collection_ }) => {
  before(async () => {
    await collection.insertMany(Array.from({ length: 50 }, (_, i) => ({ age: i })));
    await collection_.insertMany(Array.from({ length: 100 }, () => ({})));
  });

  it('should deleteMany when match is <= 20', async () => {
    const deleteManyResp = await collection.deleteMany({ age: { $lt: 10 } });
    assert.strictEqual(deleteManyResp.deletedCount, 10);
  });

  it('should deleteMany when match is > 20', async () => {
    const deleteManyResp = await collection.deleteMany({ age: { $gte: 10 } });
    assert.strictEqual(deleteManyResp.deletedCount, 40);
  });

  it('should delete all documents given an empty filter', async () => {
    await collection_.deleteMany({});
    const numDocs = await collection_.countDocuments({}, 1000);
    assert.strictEqual(numDocs, 0);
  });

  it('fails gracefully on 2XX exceptions', async () => {
    const promise = collection.deleteMany({ $invalid: 3 });

    await assert.rejects(promise, (e) => {
      assert.ok(e instanceof CollectionDeleteManyError);
      assert.ok(e.cause instanceof DataAPIResponseError);
      assert.strictEqual(e.cause.errorDescriptors.length, 1);
      assert.strictEqual(e.cause.errorDescriptors[0].errorCode, 'FILTER_INVALID_EXPRESSION');
      assert.deepStrictEqual(e.partialResult, { deletedCount: 0 });
      return true;
    });
  });

  it('fails gracefully on non-2XX exceptions', async () => {
    const collection = initCollectionWithFailingClient();
    const promise = collection.deleteMany({ _id: 3 });

    await assert.rejects(promise, (e) => {
      assert.ok(e instanceof CollectionDeleteManyError);
      assert.ok(!(e.cause instanceof DataAPIResponseError));
      assert.strictEqual(e.cause.message, 'failing_client');
      return true;
    });
  });
});
