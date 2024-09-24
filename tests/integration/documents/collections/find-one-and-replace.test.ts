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

parallel('integration.data-api.collection.find-one-and-replace', { truncateColls: 'default:before' }, ({ collection }) => {
  it('should findOneAndReplace', async () => {
    const res = await collection.insertOne({ name: 'kamelot' });
    const docId = res.insertedId;
    const resp = await collection.findOneAndReplace(
      { '_id': docId },
      { name: 'soad' },
      {
        returnDocument: 'after',
        includeResultMetadata: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value?._id, docId);
    assert.strictEqual(resp.value.name, 'soad');
  });

  it('should findOneAndReplace with returnDocument before', async () => {
    const res = await collection.insertOne({ name: 'clash' });
    const docId = res.insertedId;
    const resp = await collection.findOneAndReplace(
      { '_id': docId },
      { name: 'ignea' },
      {
        returnDocument: 'before',
        includeResultMetadata: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value?._id, docId);
    assert.strictEqual(resp.value.name, 'clash');
  });

  it('should findOneAndReplace with upsert true', async (key) => {
    const _id = key;
    const resp = await collection.findOneAndReplace(
      { _id: _id },
      { age: 13 },
      {
        includeResultMetadata: true,
        returnDocument: 'after',
        upsert: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value?._id, _id);
    assert.strictEqual(resp.value.age, 13);
  });

  it('should findOneAndReplace with upsert true and returnDocument before', async (key) => {
    const resp = await collection.findOneAndReplace(
      { _id: key },
      { age: 13 },
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
      { name: 'passcode' },
    ]);

    const res = await collection.findOneAndReplace(
      { name: 'passcode' },
      {},
      {
        sort: { name: 1 },
        returnDocument: 'after',
        includeResultMetadata: true,
      },
    );
    assert.deepStrictEqual(res.value, { _id: res.value?._id });
  });

  it('should findOneAndReplace with a projection', async (key) => {
    await collection.insertMany([
      { name: 'a', age: 42, key },
      { name: 'aa', age: 42, key },
      { name: 'aaa', age: 42, key },
    ]);

    const res = await collection.findOneAndReplace(
      { name: 'a', key },
      { name: 'b', key },
      { projection: { name: 1 }, returnDocument: 'after', includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.name, 'b');
    assert.strictEqual(res.value.age, undefined);
  });

  it('should findOneAndReplace with sort', async (key) => {
    await collection.insertMany([
      { name: 'a', key },
      { name: 'c', key },
      { name: 'b', key },
    ]);

    const res1 = await collection.findOneAndReplace(
      { key },
      { name: 'aaa', key },
      { sort: { name: 1 }, includeResultMetadata: true },
    );
    assert.strictEqual(res1.value?.name, 'a');

    const res2 = await collection.findOneAndReplace(
      { key },
      { name: 'ccc', key },
      { sort: { name: -1 }, includeResultMetadata: true },
    );
    assert.deepStrictEqual(res2.value?.name, 'c');
  });

  it('should not return metadata when includeResultMetadata is false', async (key) => {
    await collection.insertOne({ name: 'a', key });

    const res = await collection.findOneAndReplace(
      { name: 'a', key },
      { name: 'b', key },
      { returnDocument: 'after', includeResultMetadata: false },
    );
    assert.strictEqual(res?.name, 'b');
  });

  it('should not return metadata by default', async (key) => {
    await collection.insertOne({ name: 'a', key });

    const res = await collection.findOneAndReplace(
      { name: 'a', key },
      { name: 'b', key },
      { returnDocument: 'after' },
    );

    assert.strictEqual(res?.name, 'b');
  });

  it('should findOneAndReplace with $vector sort', async (key) => {
    await collection.insertMany([
      { name: 'a', $vector: [1.0, 1.0, 1.0, 1.0, 1.0], key },
      { name: 'c', $vector: [-.1, -.2, -.3, -.4, -.5], key },
      { name: 'b', $vector: [-.1, -.2, -.3, -.4, -.5], key },
    ]);

    const res = await collection.findOneAndReplace(
      { key },
      { name: 'aaa', key },
      { sort: { $vector: [1, 1, 1, 1, 1] }, includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.name, 'a');
  });

  it('should findOneAndReplace with vector sort in option', async (key) => {
    await collection.insertMany([
      { name: 'a', $vector: [1.0, 1.0, 1.0, 1.0, 1.0], key },
      { name: 'c', $vector: [-.1, -.2, -.3, -.4, -.5], key },
      { name: 'b', $vector: [-.1, -.2, -.3, -.4, -.5], key },
    ]);

    const res = await collection.findOneAndReplace(
      { key },
      { name: 'aaa', key },
      { vector: [1, 1, 1, 1, 1], includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.name, 'a');
  });

  it('should error when both sort and vector are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndReplace({}, {}, { returnDocument: 'after', sort: { name: 1 }, vector: [1, 1, 1, 1, 1] });
    }, /Can't use both `sort` and `vector` options at once; if you need both, include a \$vector key in the sort object/);
  });

  it('should error when both sort and vectorize are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndReplace({}, {}, { returnDocument: 'after', sort: { name: 1 }, vectorize: 'American Idiot is a good song' });
    }, /Can't use both `sort` and `vectorize` options at once; if you need both, include a \$vectorize key in the sort object/);
  });

  it('should error when both vector and vectorize are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndReplace({}, {}, { returnDocument: 'after', vector: [1, 1, 1, 1, 1], vectorize: 'American Idiot is a good song' });
    }, /Cannot set both vectors and vectorize options/);
  });
});
