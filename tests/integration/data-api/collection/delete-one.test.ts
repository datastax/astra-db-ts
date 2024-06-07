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

import { Collection } from '@/src/data-api';
import { createSampleDocWithMultiLevel, initTestObjects } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.delete-one', () => {
  let collection: Collection;

  before(async function () {
    [, , collection] = await initTestObjects(this);
  });

  beforeEach(async () => {
    await collection.deleteAll();
  });

  it('should deleteOne document', async () => {
    const res = await collection.insertOne(createSampleDocWithMultiLevel());
    const docId = res.insertedId;
    const deleteOneResp = await collection.deleteOne({ _id: docId });
    assert.strictEqual(deleteOneResp.deletedCount, 1);
  });

  it('should not delete any when no match in deleteOne', async () => {
    await collection.insertOne(createSampleDocWithMultiLevel());
    const deleteOneResp = await collection.deleteOne({ 'username': 'samlxyz' });
    assert.strictEqual(deleteOneResp.deletedCount, 0);
  });

  it('should deleteOne with sort', async () => {
    await collection.insertMany([
      { username: 'a' },
      { username: 'c' },
      { username: 'b' }
    ]);

    await collection.deleteOne(
      {},
      { sort: { username: 1 } }
    );

    const docs = await collection.find({}, { sort: { username: 1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.username), ['b', 'c']);
  });
});
