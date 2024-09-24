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

parallel('integration.documents.collections.find-one-and-update', { truncateColls: 'default:before' }, ({ collection }) => {
  it('should findOneAndUpdate', async () => {
    const res = await collection.insertOne({ name: 'old', age: 0 });
    const docId = res.insertedId;
    const resp = await collection.findOneAndUpdate(
      {
        _id: docId,
      },
      {
        $set: {
          name: 'new',
        },
        $unset: {
          age: '',
        },
      },
      {
        returnDocument: 'after',
        includeResultMetadata: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value?._id, docId);
    assert.strictEqual(resp.value.name, 'new');
    assert.strictEqual(resp.value.age, undefined);
  });

  it('should findOneAndUpdate with returnDocument before', async () => {
    const res = await collection.insertOne({ name: 'old', age: 0 });
    const docId = res.insertedId;
    const resp = await collection.findOneAndUpdate(
      {
        _id: docId,
      },
      {
        $set: {
          name: 'new',
        },
        $unset: {
          age: '',
        },
      },
      {
        returnDocument: 'before',
        includeResultMetadata: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value?._id, docId);
    assert.strictEqual(resp.value.name, 'old');
    assert.strictEqual(resp.value.age, 0);
  });

  it('should findOneAndUpdate with upsert true', async (key) => {
    const _id = key;
    const resp = await collection.findOneAndUpdate(
      {
        _id: _id,
      },
      {
        $set: {
          name: 'new',
        },
        $unset: {
          age: '',
        },
      },
      {
        includeResultMetadata: true,
        returnDocument: 'after',
        upsert: true,
      },
    );
    assert.strictEqual(resp.ok, 1);
    assert.strictEqual(resp.value?._id, _id);
    assert.strictEqual(resp.value.name, 'new');
    assert.strictEqual(resp.value.address, undefined);
  });

  it('should findOneAndUpdate with upsert true and returnDocument before', async (key) => {
    const _id = key;
    const resp = await collection.findOneAndUpdate(
      {
        _id: _id,
      },
      {
        $set: {
          name: 'new',
        },
        $unset: {
          age: '',
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

  it('should findOneAndUpdate without any updates to apply', async (key) => {
    await collection.insertMany([
      { name: 'a', key },
    ]);

    const res = await collection.findOneAndUpdate(
      { key },
      { $set: { name: 'a' } },
      { sort: { name: 1 }, includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.name, 'a');
  });

  it('should findOneAndUpdate with a projection', async (key) => {
    await collection.insertMany([
      { name: 'a', age: 42, key },
      { name: 'aa', age: 42, key },
      { name: 'aaa', age: 42, key },
    ]);

    const res = await collection.findOneAndUpdate(
      { name: 'a', key },
      { $set: { name: 'b' } },
      { projection: { name: 1 }, returnDocument: 'after', includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.name, 'b');
    assert.strictEqual(res.value.age, undefined);
  });

  it('should findOneAndUpdate with sort', async (key) => {
    await collection.insertMany([
      { name: 'a', key },
      { name: 'c', key },
      { name: 'b', key },
    ]);

    const res1 = await collection.findOneAndUpdate(
      { key },
      { $set: { name: 'aaa' } },
      { sort: { name: 1 }, includeResultMetadata: true },
    );
    assert.strictEqual(res1.value?.name, 'a');

    const res2 = await collection.findOneAndUpdate(
      { key },
      { $set: { name: 'ccc' } },
      { sort: { name: -1 }, includeResultMetadata: true },
    );
    assert.deepStrictEqual(res2.value?.name, 'c');
  });

  it('should not return metadata when includeResultMetadata is false', async (key) => {
    await collection.insertOne({ name: 'a', key });

    const res = await collection.findOneAndUpdate(
      { name: 'a', key },
      { $set: { name: 'b' } },
      { returnDocument: 'after', includeResultMetadata: false },
    );

    assert.deepStrictEqual(res, { _id: res?._id, name: 'b', key });
  });

  it('should not return metadata by default', async (key) => {
    await collection.insertOne({ name: 'a', key });

    const res = await collection.findOneAndUpdate(
      { name: 'a', key },
      { $set: { name: 'b' } },
      { returnDocument: 'after' },
    );

    assert.deepStrictEqual(res, { _id: res?._id, name: 'b', key });
  });

  it('should findOneAndUpdate with $vector sort', async (key) => {
    await collection.insertMany([
      { name: 'a', $vector: [1.0, 1.0, 1.0, 1.0, 1.0], key },
      { name: 'c', $vector: [-.1, -.2, -.3, -.4, -.5], key },
      { name: 'b', $vector: [-.1, -.2, -.3, -.4, -.5], key },
    ]);

    const res = await collection.findOneAndUpdate(
      { key },
      { $set: { name: 'aaa' } },
      { sort: { $vector: [1, 1, 1, 1, 1] }, includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.name, 'a');
  });

  it('should findOneAndUpdate with vector sort in option', async (key) => {
    await collection.insertMany([
      { name: 'a', $vector: [1.0, 1.0, 1.0, 1.0, 1.0], key },
      { name: 'c', $vector: [-.1, -.2, -.3, -.4, -.5], key },
      { name: 'b', $vector: [-.1, -.2, -.3, -.4, -.5], key },
    ]);

    const res = await collection.findOneAndUpdate(
      { key },
      { $set: { name: 'aaa' } },
      { vector: [1, 1, 1, 1, 1], includeResultMetadata: true },
    );
    assert.strictEqual(res.value?.name, 'a');
  });

  it('should error when both sort and vector are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndUpdate({}, {}, { returnDocument: 'after', sort: { name: 1 }, vector: [1, 1, 1, 1, 1] });
    }, /Can't use both `sort` and `vector` options at once; if you need both, include a \$vector key in the sort object/);
  });

  it('should error when both sort and vectorize are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndUpdate({}, {}, { returnDocument: 'after', sort: { name: 1 }, vectorize: 'American Idiot is a good song' });
    }, /Can't use both `sort` and `vectorize` options at once; if you need both, include a \$vectorize key in the sort object/);
  });

  it('should error when both vector and vectorize are provided', async () => {
    await assert.rejects(async () => {
      await collection.findOneAndUpdate({}, {}, { returnDocument: 'after', vector: [1, 1, 1, 1, 1], vectorize: 'American Idiot is a good song' });
    }, /Cannot set both vectors and vectorize options/);
  });
});
