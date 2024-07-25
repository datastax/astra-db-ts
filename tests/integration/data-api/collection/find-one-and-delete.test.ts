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

import { createSampleDocWithMultiLevel } from '@/tests/fixtures';
import { describe, it } from '@/tests/test-utils';
import assert from 'assert';

describe('integration.data-api.collection.find-one-and-delete', { truncateColls: 'default' }, ({ collection }) => {
  it('should findOneAndDelete', async () => {
    const res = await collection.insertOne(createSampleDocWithMultiLevel());
    const docId = res.insertedId;
    const resp = await collection.findOneAndDelete(
      {
        '_id': docId,
      },
      {
        includeResultMetadata: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value?._id, docId);
    assert.strictEqual(resp.value.username, 'aaron');
    assert.strictEqual(resp.value.address?.city, 'big banana');
  });

  it('should findOneAndDelete with a projection', async () => {
    await collection.insertMany([
      { username: 'a', answer: 42 },
      { username: 'aa', answer: 42 },
      { username: 'aaa', answer: 42 },
    ]);

    const res = await collection.findOneAndDelete(
      { username: 'a' },
      { projection: { username: 1 }, includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.username, 'a');
    assert.strictEqual(res.value.answer, undefined);
  });

  it('should findOneAndDelete with sort', async () => {
    await collection.insertMany([
      { username: 'a' },
      { username: 'c' },
      { username: 'b' },
    ]);

    let res = await collection.findOneAndDelete(
      {},
      { sort: { username: 1 }, includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.username, 'a');

    res = await collection.findOneAndDelete(
      {},
      { sort: { username: -1 }, includeResultMetadata: true },
    );
    assert.deepStrictEqual(res.value?.username, 'c');
  });

  it('should not return metadata when includeResultMetadata is false', async () => {
    await collection.insertOne({ username: 'a' });
    const res = await collection.findOneAndDelete(
      { username: 'a' },
      { includeResultMetadata: false },
    );

    assert.deepStrictEqual(res, { _id: res?._id, username: 'a' });
  });

  it('should not return metadata by default', async () => {
    await collection.insertOne({ username: 'a' });
    const res = await collection.findOneAndDelete(
      { username: 'a' },
    );

    assert.deepStrictEqual(res, { _id: res?._id, username: 'a' });
  });

  it('should findOneAndDelete with $vector sort', async () => {
    await collection.insertMany([
      { username: 'a', $vector: [1.0, 1.0, 1.0, 1.0, 1.0] },
      { username: 'c', $vector: [-.1, -.1, -.1, -.1, -.1] },
      { username: 'b', $vector: [-.1, -.1, -.1, -.1, -.1] },
    ]);

    const res = await collection.findOneAndDelete(
      {},
      { sort: { $vector: [1, 1, 1, 1, 1] }, includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.username, 'a');
  });

  it('should findOneAndDelete with vector sort in option', async () => {
    await collection.insertMany([
      { username: 'a', $vector: [1.0, 1.0, 1.0, 1.0, 1.0] },
      { username: 'c', $vector: [-.1, -.1, -.1, -.1, -.1] },
      { username: 'b', $vector: [-.1, -.1, -.1, -.1, -.1] },
    ]);

    const res = await collection.findOneAndDelete(
      {},
      { vector: [1, 1, 1, 1, 1], includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.username, 'a');
  });

  it('should error when both sort and vector are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndDelete({}, { sort: { username: 1 }, vector: [1, 1, 1, 1, 1] });
    }, /Can't use both `sort` and `vector` options at once; if you need both, include a \$vector key in the sort object/)
  });

  it('should error when both sort and vectorize are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndDelete({}, { sort: { username: 1 }, vectorize: 'American Idiot is a good song' });
    }, /Can't use both `sort` and `vectorize` options at once; if you need both, include a \$vectorize key in the sort object/)
  });

  it('should error when both vector and vectorize are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndDelete({}, { vector: [1, 1, 1, 1, 1], vectorize: 'American Idiot is a good song' });
    }, /Cannot set both vectors and vectorize options/)
  });
});
