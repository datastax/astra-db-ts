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

import { it, parallel } from '@/tests/testlib';
import assert from 'assert';

parallel('integration.data-api.collection.replace-one', { truncateColls: 'default:before' }, ({ collection }) => {
  it('should replaceOne', async (key) => {
    const res = await collection.insertOne({ name: 'deep_purple', key });
    const docId = res.insertedId;
    const resp = await collection.replaceOne(
      { _id: docId, key },
      { name: 'shallow_yellow_green' },
    );
    assert.strictEqual(resp.matchedCount, 1);
    assert.strictEqual(resp.modifiedCount, 1);
  });

  it('should replaceOne with same doc', async (key) => {
    const res = await collection.insertOne({ name: 'halestorm', key });
    const docId = res.insertedId;
    const resp = await collection.replaceOne(
      { _id: docId, key },
      { name: 'halestorm', key },
    );
    assert.strictEqual(resp.matchedCount, 1);
    assert.strictEqual(resp.modifiedCount, 0);
  });

  it('should replaceOne with multiple matches', async (key) => {
    await collection.insertMany([
      { key },
      { key },
    ]);

    const resp = await collection.replaceOne(
      { key },
      { key: 'ignea' },
    );

    assert.strictEqual(resp.matchedCount, 1);
    assert.strictEqual(resp.modifiedCount, 1);
  });

  it('should replaceOne with upsert true if match', async (key) => {
    await collection.insertOne({ _id: key });

    const resp = await collection.replaceOne(
      { _id: key },
      { key: key },
      { upsert: true, },
    );

    assert.strictEqual(resp.matchedCount, 1);
    assert.strictEqual(resp.modifiedCount, 1);
    assert.strictEqual(resp.upsertedCount, 0);
    assert.strictEqual(resp.upsertedId, undefined);
  });

  it('should replaceOne with upsert true if no match', async (key) => {
    await collection.insertOne({});

    const resp = await collection.replaceOne(
      { _id: key },
      { key: key },
      { upsert: true },
    );

    assert.strictEqual(resp.matchedCount, 0);
    assert.strictEqual(resp.modifiedCount, 0);
    assert.strictEqual(resp.upsertedCount, 1);
    assert.strictEqual(resp.upsertedId, key);
  });

  it('should replaceOne with an empty doc', async (key) => {
    await collection.insertMany([
      { name: 'a', key },
    ]);

    const res = await collection.replaceOne(
      { name: 'a', key },
      {},
    );
    assert.strictEqual(res.matchedCount, 1);
    assert.strictEqual(res.modifiedCount, 1);
  });

  it('should replaceOne with sort', async (key) => {
    await collection.insertMany([
      { name: 'a', key },
      { name: 'c', key },
      { name: 'b', key },
    ]);

    const res1 = await collection.replaceOne(
      { key },
      { name: 'aaa', key },
      { sort: { name: 1 } },
    );
    assert.strictEqual(res1.matchedCount, 1);
    assert.strictEqual(res1.modifiedCount, 1);

    const res2 = await collection.replaceOne(
      { key },
      { name: 'ccc', key },
      { sort: { name: -1 } },
    );
    assert.strictEqual(res2.matchedCount, 1);
    assert.strictEqual(res2.modifiedCount, 1);

    const found = await collection.find({ key }).toArray();
    assert.deepStrictEqual(found.map(d => d.name).sort(), ['aaa', 'b', 'ccc']);
  });

  it('should replaceOne with $vector sort', async (key) => {
    await collection.insertMany([
      { name: 'a', $vector: [1.0, 1.0, 1.0, 1.0, 1.0], key },
      { name: 'c', $vector: [-.1, -.2, -.3, -.4, -.5], key },
      { name: 'b', $vector: [-.1, -.2, -.3, -.4, -.5], key },
    ]);

    const res = await collection.replaceOne(
      { key },
      { name: 'aaa' },
      { sort: { $vector: [1, 1, 1, 1, 1] } },
    );
    assert.strictEqual(res.matchedCount, 1);
    assert.strictEqual(res.modifiedCount, 1);
  });

  it('should replaceOne with vector sort in option', async (key) => {
    await collection.insertMany([
      { name: 'a', $vector: [1.0, 1.0, 1.0, 1.0, 1.0], key },
      { name: 'c', $vector: [-.1, -.2, -.3, -.4, -.5], key },
      { name: 'b', $vector: [-.1, -.2, -.3, -.4, -.5], key },
    ]);

    const res = await collection.replaceOne(
      { key },
      { name: 'aaa' },
      { vector: [1, 1, 1, 1, 1] },
    );
    assert.strictEqual(res.matchedCount, 1);
    assert.strictEqual(res.modifiedCount, 1);
  });

  it('should error when both sort and vector are provided', async () => {
    await assert.rejects(async () => {
      await collection.replaceOne({}, {}, { sort: { name: 1 }, vector: [1, 1, 1, 1, 1] });
    }, /Can't use both `sort` and `vector` options at once; if you need both, include a \$vector key in the sort object/);
  });

  it('should error when both sort and vectorize are provided', async () => {
    await assert.rejects(async () => {
      await collection.replaceOne({}, {}, { sort: { name: 1 }, vectorize: 'American Idiot is a good song' });
    }, /Can't use both `sort` and `vectorize` options at once; if you need both, include a \$vectorize key in the sort object/);
  });

  it('should error when both vector and vectorize are provided', async () => {
    await assert.rejects(async () => {
      await collection.replaceOne({}, {}, { vector: [1, 1, 1, 1, 1], vectorize: 'American Idiot is a good song' });
    }, /Cannot set both vectors and vectorize options/);
  });
});
