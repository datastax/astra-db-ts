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

import { DataAPIError, DeleteManyError } from '@/src/data-api';
import { describe, initCollectionWithFailingClient, it } from '@/tests/testlib';
import assert from 'assert';

describe('integration.data-api.collection.delete-many', { truncateColls: 'default' }, ({ collection }) => {
  it('should deleteMany when match is <= 20', async () => {
    const docList = Array.from({ length: 20 }, () => ({ 'username': 'id', 'city': 'trichy' }));
    docList.forEach((doc, index) => {
      doc.username = doc.username + String(index + 1);
    });
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, 20);
    const deleteManyResp = await collection.deleteMany({ 'city': 'trichy' });
    assert.strictEqual(deleteManyResp.deletedCount, 20);
  });

  it('should deleteMany when match is > 20', async () => {
    const docList = Array.from({ length: 101 }, () => ({ 'username': 'id', 'city': 'trichy' }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, 101);
    const deleteManyResp = await collection.deleteMany({ 'city': 'trichy' });
    assert.strictEqual(deleteManyResp.deletedCount, 101);
  });

  it('should deleteMany with an empty filter', async () => {
    const docList = Array.from({ length: 20 }, () => ({ 'username': 'id', 'city': 'trichy' }));
    const res = await collection.insertMany(docList);
    assert.strictEqual(res.insertedCount, 20);
    await collection.deleteMany({});
    const numDocs = await collection.countDocuments({}, 1000);
    assert.strictEqual(numDocs, 0);
  });

  it('fails gracefully on 2XX exceptions', async () => {
    try {
      await collection.deleteMany({ $invalidOperator: 1 })
      assert.fail('Expected error');
    } catch (e) {
      assert.ok(e instanceof DeleteManyError);
      assert.strictEqual(e.errorDescriptors[0].errorCode, 'INVALID_FILTER_EXPRESSION');
      assert.strictEqual(e.detailedErrorDescriptors[0].errorDescriptors[0].errorCode, 'INVALID_FILTER_EXPRESSION');
      assert.strictEqual(e.errorDescriptors.length, 1);
      assert.strictEqual(e.detailedErrorDescriptors.length, 1);
      assert.deepStrictEqual(e.partialResult, { deletedCount: 0 });
      assert.deepStrictEqual(e.errorDescriptors[0].attributes, {});
    }
  });

  it('fails fast on hard errors', async () => {
    const collection = initCollectionWithFailingClient();
    try {
      await collection.deleteMany({ _id: 3 });
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.ok(!(e instanceof DataAPIError));
      assert.strictEqual(e.message, 'test');
    }
  });
});
