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

import { it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';

parallel('integration.documents.collections.find-one-and-delete', { truncate: 'colls:before' }, ({ collection }) => {
  it('should findOneAndDelete', async () => {
    const res = await collection.insertOne({ name: 'kamelot' });
    const docId = res.insertedId;
    const resp = await collection.findOneAndDelete(
      { '_id': docId },
    );
    assert.strictEqual(resp?._id, docId);
    assert.strictEqual(resp.name, 'kamelot');
  });

  it('should findOneAndDelete with a projection', async (key) => {
    await collection.insertMany([
      { name: 'a', age: 42, key },
      { name: 'aa', age: 42, key },
      { name: 'aaa', age: 42, key },
    ]);

    const res = await collection.findOneAndDelete(
      { name: 'a', key },
      { projection: { name: 1 } },
    );
    assert.strictEqual(res?.name, 'a');
    assert.strictEqual(res.age, undefined);
  });

  it('should findOneAndDelete with sort', async (key) => {
    await collection.insertMany([
      { name: 'a', key },
      { name: 'c', key },
      { name: 'b', key },
    ]);

    const res1 = await collection.findOneAndDelete(
      { key },
      { sort: { name: 1 } },
    );
    assert.strictEqual(res1?.name, 'a');

    const res2 = await collection.findOneAndDelete(
      { key },
      { sort: { name: -1 } },
    );
    assert.deepStrictEqual(res2?.name, 'c');
  });

  it('should not return metadata when includeResultMetadata is false', async (key) => {
    await collection.insertOne({ name: 'a', key });

    const res = await collection.findOneAndDelete(
      { name: 'a', key },
    );

    assert.deepStrictEqual(res, { _id: res?._id, name: 'a', key });
  });

  it('should not return metadata by default', async (key) => {
    await collection.insertOne({ name: 'b', key });

    const res = await collection.findOneAndDelete(
      { name: 'b', key },
    );

    assert.deepStrictEqual(res, { _id: res?._id, name: 'b', key });
  });

  it('should findOneAndDelete with $vector sort', async (key) => {
    await collection.insertMany([
      { name: 'a', $vector: [1.0, 1.0, 0.9, 1.0, 1.0], key },
      { name: 'c', $vector: [-.4, -.2, -.3, -.4, -.1], key },
      { name: 'b', $vector: [-.1, -.2, -.3, -.4, -.5], key },
    ]);

    const res = await collection.findOneAndDelete(
      { key },
      { sort: { $vector: [1, 1, 1, 1, 1] } },
    );
    assert.strictEqual(res?.name, 'a');
  });

  it('should return null if no document is found', async (key) => {
    const res = await collection.findOneAndDelete({ key });
    assert.strictEqual(res, null);
  });
});
