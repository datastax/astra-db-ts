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
import { oid, uuid, vector } from '@/src/documents/index.js';

parallel('integration.documents.collections.find-one-and-update', { truncate: 'colls:before' }, ({ collection }) => {
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
      },
    );
    assert.strictEqual(resp?._id, docId);
    assert.strictEqual(resp.name, 'new');
    assert.strictEqual(resp.age, undefined);
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
      },
    );
    assert.strictEqual(resp?._id, docId);
    assert.strictEqual(resp.name, 'old');
    assert.strictEqual(resp.age, 0);
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
        returnDocument: 'after',
        upsert: true,
      },
    );
    assert.strictEqual(resp?._id, _id);
    assert.strictEqual(resp.name, 'new');
    assert.strictEqual(resp.address, undefined);
  });

  it('should findOneAndUpdate with upsert true and returnDocument before', async (key) => {
    const resp = await collection.findOneAndUpdate(
      {
        _id: key,
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
        upsert: true,
      },
    );
    assert.strictEqual(resp, null);
  });

  it('should findOneAndUpdate without any updates to apply', async (key) => {
    await collection.insertMany([
      { name: 'a', key },
    ]);

    const res = await collection.findOneAndUpdate(
      { key },
      { $set: { name: 'a' } },
      { sort: { name: 1 } },
    );
    assert.strictEqual(res?.name, 'a');
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
      { projection: { name: 1 }, returnDocument: 'after' },
    );
    assert.strictEqual(res?.name, 'b');
    assert.strictEqual(res.age, undefined);
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
      { sort: { name: 1 } },
    );
    assert.strictEqual(res1?.name, 'a');

    const res2 = await collection.findOneAndUpdate(
      { key },
      { $set: { name: 'ccc' } },
      { sort: { name: -1 } },
    );
    assert.deepStrictEqual(res2?.name, 'c');
  });

  it('should not return metadata when includeResultMetadata is false', async (key) => {
    await collection.insertOne({ name: 'a', key });

    const res = await collection.findOneAndUpdate(
      { name: 'a', key },
      { $set: { name: 'b' } },
      { returnDocument: 'after' },
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
      { sort: { $vector: [1, 1, 1, 1, 1] } },
    );
    assert.strictEqual(res?.name, 'a');
  });

  it('should return null if no document is found', async (key) => {
    const res = await collection.findOneAndUpdate({ key }, { $set: { car: 'bus' } });
    assert.strictEqual(res, null);
  });

  it('should work with datatypes', async (key) => {
    const docs = <const>[
      { _id: `a${key}`, name: 'a', key, uuid: uuid.v4() },
      { _id: `b${key}`, name: 'b', key, oid: oid() },
      { _id: `c${key}`, name: 'c', key, date: new Date() },
      { _id: `d${key}`, name: 'd', key, $vector: vector({ $binary: vector([.1, .2, .3, .4, .5]).asBase64() }) },
    ];
    await collection.insertMany(docs);

    const expected = [...docs, null];

    for (let i = 0; i <= docs.length; i++) {
      const updated = await collection.findOneAndUpdate({ key, touched: { $ne: 1 } }, { $set: { touched: 1 } }, { sort: { name: 1 }, projection: { $vector: 1, touched: 0 } });
      assert.deepStrictEqual(updated, expected[i]);
    }
  });
});
