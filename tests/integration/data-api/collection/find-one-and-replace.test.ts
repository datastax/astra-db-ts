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
import { createSampleDoc2WithMultiLevel, createSampleDocWithMultiLevel, initTestObjects } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.find-one-and-replace', () => {
  let collection: Collection;

  before(async function () {
    [, , collection] = await initTestObjects();
  });

  beforeEach(async () => {
    await collection.deleteMany({});
  });

  it('should findOneAndReplace', async () => {
    const res = await collection.insertOne(createSampleDocWithMultiLevel());
    const docId = res.insertedId;
    const resp = await collection.findOneAndReplace(
      {
        '_id': docId,
      },
      createSampleDoc2WithMultiLevel(),
      {
        returnDocument: 'after',
        includeResultMetadata: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value?._id, docId);
    assert.strictEqual(resp.value.username, 'jimr');
    assert.strictEqual(resp.value.address?.city, 'nyc');
    assert.strictEqual(resp.value.address.country, 'usa');
  });

  it('should findOneAndReplace with returnDocument before', async () => {
    const docToInsert = createSampleDocWithMultiLevel();
    const res = await collection.insertOne(docToInsert);
    const docId = res.insertedId;
    const cityBefore = docToInsert.address?.city;
    const usernameBefore = docToInsert.username;
    const resp = await collection.findOneAndReplace(
      {
        '_id': docId,
      },
      createSampleDoc2WithMultiLevel(),
      {
        returnDocument: 'before',
        includeResultMetadata: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value?._id, docId);
    assert.strictEqual(resp.value.username, usernameBefore);
    assert.strictEqual(resp.value.address?.city, cityBefore);
    assert.strictEqual(resp.value.address.country, undefined);
  });

  it('should findOneAndReplace with upsert true', async () => {
    await collection.insertOne(createSampleDocWithMultiLevel());
    const newDocId = '123';
    const resp = await collection.findOneAndReplace(
      {
        '_id': newDocId,
      },
      createSampleDoc2WithMultiLevel(),
      {
        includeResultMetadata: true,
        returnDocument: 'after',
        upsert: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value?._id, newDocId);
    assert.strictEqual(resp.value.username, 'jimr');
    assert.strictEqual(resp.value.address?.city, 'nyc');
    assert.strictEqual(resp.value.address.country, 'usa');
  });

  it('should findOneAndReplace with upsert true and returnDocument before', async () => {
    await collection.insertOne(createSampleDocWithMultiLevel());
    const newDocId = '123';
    const resp = await collection.findOneAndReplace(
      {
        '_id': newDocId,
      },
      createSampleDoc2WithMultiLevel(),
      {
        includeResultMetadata: true,
        returnDocument: 'before',
        upsert: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value, null);
  });

  it('should findOneAndReplace with an empty doc', async () => {
    await collection.insertMany([
      { username: 'a' },
    ]);

    const res = await collection.findOneAndReplace(
      { username: 'a' },
      {},
      { sort: { username: 1 }, returnDocument: 'after', includeResultMetadata: true },
    );
    assert.deepStrictEqual(res.value, { _id: res.value?._id });
  });

  it('should findOneAndReplace with a projection', async () => {
    await collection.insertMany([
      { username: 'a', answer: 42 },
      { username: 'aa', answer: 42 },
      { username: 'aaa', answer: 42 },
    ]);

    const res = await collection.findOneAndReplace(
      { username: 'a' },
      { username: 'b' },
      { projection: { username: 1 }, returnDocument: 'after', includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.username, 'b');
    assert.strictEqual(res.value.answer, undefined);
  });

  it('should findOneAndReplace with sort', async () => {
    await collection.insertMany([
      { username: 'a' },
      { username: 'c' },
      { username: 'b' },
    ]);

    let res = await collection.findOneAndReplace(
      {},
      { username: 'aaa' },
      { sort: { username: 1 }, returnDocument: 'before', includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.username, 'a');

    res = await collection.findOneAndReplace(
      {},
      { username: 'ccc' },
      { sort: { username: -1 }, returnDocument: 'before', includeResultMetadata: true },
    );
    assert.deepStrictEqual(res.value?.username, 'c');
  });

  it('should not return metadata when includeResultMetadata is false', async () => {
    await collection.insertOne({ username: 'a' });

    const res = await collection.findOneAndReplace(
      { username: 'a' },
      { username: 'b' },
      { returnDocument: 'after', includeResultMetadata: false },
    );
    assert.strictEqual(res?.username, 'b');
  });

  it('should not return metadata by default', async () => {
    await collection.insertOne({ username: 'a' });
    const res = await collection.findOneAndReplace(
      { username: 'a' },
      { username: 'b' },
      { returnDocument: 'after' },
    );

    assert.strictEqual(res?.username, 'b');
  });

  it('should findOneAndReplace with $vector sort', async () => {
    await collection.insertMany([
      { username: 'a', $vector: [1.0, 1.0, 1.0, 1.0, 1.0] },
      { username: 'c', $vector: [-.1, -.1, -.1, -.1, -.1] },
      { username: 'b', $vector: [-.1, -.1, -.1, -.1, -.1] },
    ]);

    const res = await collection.findOneAndReplace(
      {},
      { username: 'aaa' },
      { sort: { $vector: [1, 1, 1, 1, 1] }, returnDocument: 'before', includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.username, 'a');
  });

  it('should findOneAndReplace with vector sort in option', async () => {
    await collection.insertMany([
      { username: 'a', $vector: [1.0, 1.0, 1.0, 1.0, 1.0] },
      { username: 'c', $vector: [-.1, -.1, -.1, -.1, -.1] },
      { username: 'b', $vector: [-.1, -.1, -.1, -.1, -.1] },
    ]);

    const res = await collection.findOneAndReplace(
      {},
      { username: 'aaa' },
      { vector: [1, 1, 1, 1, 1], returnDocument: 'before', includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.username, 'a');
  });

  it('should error when both sort and vector are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndReplace({}, {}, { returnDocument: 'after', sort: { username: 1 }, vector: [1, 1, 1, 1, 1] });
    }, /Can't use both `sort` and `vector` options at once; if you need both, include a \$vector key in the sort object/)
  });

  it('should error when both sort and vectorize are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndReplace({}, {}, { returnDocument: 'after', sort: { username: 1 }, vectorize: 'American Idiot is a good song' });
    }, /Can't use both `sort` and `vectorize` options at once; if you need both, include a \$vectorize key in the sort object/)
  });

  it('should error when both vector and vectorize are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndReplace({}, {}, { returnDocument: 'after', vector: [1, 1, 1, 1, 1], vectorize: 'American Idiot is a good song' });
    }, /Cannot set both vectors and vectorize options/)
  });
});
