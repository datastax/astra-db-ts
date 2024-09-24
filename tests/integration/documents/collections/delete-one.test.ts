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

import { it, parallel } from '@/tests/testlib';
import assert from 'assert';

parallel('integration.documents.collections.delete-one', { truncateColls: 'default:before' }, ({ collection }) => {
  it('should deleteOne document', async () => {
    const res = await collection.insertOne({});
    const deleteOneResp = await collection.deleteOne({ _id: res.insertedId });
    assert.strictEqual(deleteOneResp.deletedCount, 1);
  });

  it('should not delete any when no match in deleteOne', async () => {
    await collection.insertOne({});
    const deleteOneResp = await collection.deleteOne({ 'name': 'band-maid' });
    assert.strictEqual(deleteOneResp.deletedCount, 0);
  });

  it('should deleteOne with sort', async (key) => {
    await collection.insertMany([
      { name: 'a', key },
      { name: 'c', key },
      { name: 'b', key },
    ]);

    await collection.deleteOne(
      { key },
      { sort: { name: 1 } },
    );

    const docs = await collection.find({ key }, { sort: { name: 1 }, limit: 20 }).toArray();
    assert.deepStrictEqual(docs.map(doc => doc.name), ['b', 'c']);
  });
});
