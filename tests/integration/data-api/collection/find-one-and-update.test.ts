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

describe('integration.data-api.collection.find-one-and-update', { truncateColls: 'default' }, ({ collection }) => {
  it('should findOneAndUpdate', async () => {
    const res = await collection.insertOne(createSampleDocWithMultiLevel());
    const docId = res.insertedId;
    const resp = await collection.findOneAndUpdate(
      {
        '_id': docId,
      },
      {
        '$set': {
          'username': 'aaronm',
        },
        '$unset': {
          'address.city': '',
        },
      },
      {
        returnDocument: 'after',
        includeResultMetadata: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value?._id, docId);
    assert.strictEqual(resp.value.username, 'aaronm');
    assert.strictEqual(resp.value.address?.city, undefined);
  });

  it('should findOneAndUpdate with returnDocument before', async () => {
    const docToInsert = createSampleDocWithMultiLevel();
    const res = await collection.insertOne(docToInsert);
    const docId = res.insertedId;
    const cityBefore = docToInsert.address?.city;
    const usernameBefore = docToInsert.username;
    const resp = await collection.findOneAndUpdate(
      {
        '_id': docId,
      },
      {
        '$set': {
          'username': 'aaronm',
        },
        '$unset': {
          'address.city': '',
        },
      },
      {
        returnDocument: 'before',
        includeResultMetadata: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value?._id, docId);
    assert.strictEqual(resp.value.username, usernameBefore);
    assert.strictEqual(resp.value.address?.city, cityBefore);
  });

  it('should findOneAndUpdate with upsert true', async () => {
    await collection.insertOne(createSampleDocWithMultiLevel());
    const newDocId = '123';
    const resp = await collection.findOneAndUpdate(
      {
        '_id': newDocId,
      },
      {
        '$set': {
          'username': 'aaronm',
        },
        '$unset': {
          'address.city': '',
        },
      },
      {
        includeResultMetadata: true,
        returnDocument: 'after',
        upsert: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value?._id, newDocId);
    assert.strictEqual(resp.value.username, 'aaronm');
    assert.strictEqual(resp.value.address, undefined);
  });

  it('should findOneAndUpdate with upsert true and returnDocument before', async () => {
    await collection.insertOne(createSampleDocWithMultiLevel());
    const newDocId = '123';
    const resp = await collection.findOneAndUpdate(
      {
        '_id': newDocId,
      },
      {
        '$set': {
          'username': 'aaronm',
        },
        '$unset': {
          'address.city': '',
        },
      },
      {
        includeResultMetadata: true,
        returnDocument: 'before',
        upsert: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value, null);
  });

  it('should findOneAndUpdate without any updates to apply', async () => {
    await collection.insertMany([
      { username: 'a' },
    ]);

    const res = await collection.findOneAndUpdate(
      {},
      { $set: { username: 'a' } },
      { sort: { username: 1 }, returnDocument: 'before', includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.username, 'a');
  });

  it('should findOneAndUpdate with a projection', async () => {
    await collection.insertMany([
      { username: 'a', answer: 42 },
      { username: 'aa', answer: 42 },
      { username: 'aaa', answer: 42 },
    ]);

    const res = await collection.findOneAndUpdate(
      { username: 'a' },
      { $set: { username: 'b' } },
      { projection: { username: 1 }, returnDocument: 'after', includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.username, 'b');
    assert.strictEqual(res.value.answer, undefined);
  });

  it('should findOneAndUpdate with sort', async () => {
    await collection.deleteMany({});
    await collection.insertMany([
      { username: 'a' },
      { username: 'c' },
      { username: 'b' },
    ]);

    let res = await collection.findOneAndUpdate(
      {},
      { $set: { username: 'aaa' } },
      { sort: { username: 1 }, returnDocument: 'before', includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.username, 'a');

    res = await collection.findOneAndUpdate(
      {},
      { $set: { username: 'ccc' } },
      { sort: { username: -1 }, returnDocument: 'before', includeResultMetadata: true },
    );
    assert.deepStrictEqual(res.value?.username, 'c');
  });

  it('should not return metadata when includeResultMetadata is false', async () => {
    await collection.insertOne({ username: 'a' });
    const res = await collection.findOneAndUpdate(
      { username: 'a' },
      { $set: { username: 'b' } },
      { returnDocument: 'after', includeResultMetadata: false },
    );

    assert.deepStrictEqual(res, { _id: res?._id, username: 'b' });
  });

  it('should not return metadata by default', async () => {
    await collection.insertOne({ username: 'a' });
    const res = await collection.findOneAndUpdate(
      { username: 'a' },
      { $set: { username: 'b' } },
      { returnDocument: 'after' },
    );

    assert.deepStrictEqual(res, { _id: res?._id, username: 'b' });
  });

  it('should findOneAndUpdate with $vector sort', async () => {
    await collection.insertMany([
      { username: 'a', $vector: [1.0, 1.0, 1.0, 1.0, 1.0] },
      { username: 'c', $vector: [-.1, -.1, -.1, -.1, -.1] },
      { username: 'b', $vector: [-.1, -.1, -.1, -.1, -.1] },
    ]);

    const res = await collection.findOneAndUpdate(
      {},
      { $set: { username: 'aaa' } },
      { sort: { $vector: [1, 1, 1, 1, 1] }, returnDocument: 'before', includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.username, 'a');
  });

  it('should findOneAndUpdate with vector sort in option', async () => {
    await collection.insertMany([
      { username: 'a', $vector: [1.0, 1.0, 1.0, 1.0, 1.0] },
      { username: 'c', $vector: [-.1, -.1, -.1, -.1, -.1] },
      { username: 'b', $vector: [-.1, -.1, -.1, -.1, -.1] },
    ]);

    const res = await collection.findOneAndUpdate(
      {},
      { $set: { username: 'aaa' } },
      { vector: [1, 1, 1, 1, 1], returnDocument: 'before', includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.username, 'a');
  });

  it('should error when both sort and vector are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndUpdate({}, {}, { returnDocument: 'after', sort: { username: 1 }, vector: [1, 1, 1, 1, 1] });
    }, /Can't use both `sort` and `vector` options at once; if you need both, include a \$vector key in the sort object/)
  });

  it('should error when both sort and vectorize are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndUpdate({}, {}, { returnDocument: 'after', sort: { username: 1 }, vectorize: 'American Idiot is a good song' });
    }, /Can't use both `sort` and `vectorize` options at once; if you need both, include a \$vectorize key in the sort object/)
  });

  it('should error when both vector and vectorize are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndUpdate({}, {}, { returnDocument: 'after', vector: [1, 1, 1, 1, 1], vectorize: 'American Idiot is a good song' });
    }, /Cannot set both vectors and vectorize options/)
  });
});
