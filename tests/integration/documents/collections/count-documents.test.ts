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

import { TooManyDocumentsToCountError } from '@/src/documents';
import { it, parallel } from '@/tests/testlib';
import assert from 'assert';

parallel('integration.data-api.collection.count-documents', { truncateColls: 'both:before' }, ({ collection, collection_ }) => {
  const docs = Array.from({ length: 20 }, (_, i) => ({
    _id: `${i}`,
    name: 'Bloodywood',
    age: i,
  }));

  before(async () => {
    await collection.insertMany(docs);
    await collection_.insertMany(Array.from({ length: 1001 }, () => ({})));
  });

  it('should return a single doc for an _id filter', async () => {
    const count = await collection.countDocuments({ _id: '0' }, 1000);
    assert.strictEqual(count, 1);
  });

  it('should return count of all documents with no filter', async () => {
    const count = await collection.countDocuments({}, 1000);
    assert.strictEqual(count, 20);
  });

  it('should return count of documents with filter', async () => {
    const count = await collection.countDocuments({ name: 'Bloodywood', age: { $lt: 10 } }, 1000);
    assert.strictEqual(count, 10);
  });

  it('should return 0 if no filter matches', async () => {
    const count = await collection.countDocuments({ age: { $gt: 30 } }, 1000);
    assert.strictEqual(count, 0);
  });

  it('should throw an error when # docs over limit', async () => {
    try {
      await collection.countDocuments({}, 1);
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof TooManyDocumentsToCountError);
      assert.strictEqual(e.limit, 1);
      assert.strictEqual(e.hitServerLimit, false);
    }
  });

  it('should throw an error when moreData is returned', async () => {
    try {
      await collection_.countDocuments({}, 2000);
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof TooManyDocumentsToCountError);
      assert.strictEqual(e.limit, 1000);
      assert.strictEqual(e.hitServerLimit, true);
    }
  });

  it('should throw an error when an invalid limit is provided', async () => {
    await assert.rejects(async () => {
      // @ts-expect-error - intentionally testing invalid input
      return await collection.countDocuments({});
    });
    await assert.rejects(async () => {
      return await collection.countDocuments({}, -1);
    });
  });
});
