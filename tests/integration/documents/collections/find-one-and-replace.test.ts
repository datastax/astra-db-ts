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

parallel('integration.documents.collections.find-one-and-replace', { truncate: 'colls:before' }, ({ collection }) => {
  it('should findOneAndReplace', async () => {
    const res = await collection.insertOne({ name: 'kamelot' });
    const docId = res.insertedId;
    const resp = await collection.findOneAndReplace(
      { '_id': docId },
      { name: 'soad' },
      {
        returnDocument: 'after',
      },
    );
    assert.strictEqual(resp?._id, docId);
    assert.strictEqual(resp.name, 'soad');
  });

  it('should findOneAndReplace with returnDocument before', async () => {
    const res = await collection.insertOne({ name: 'clash' });
    const docId = res.insertedId;
    const resp = await collection.findOneAndReplace(
      { '_id': docId },
      { name: 'ignea' },
      {
        returnDocument: 'before',
      },
    );
    assert.strictEqual(resp?._id, docId);
    assert.strictEqual(resp.name, 'clash');
  });

  it('should findOneAndReplace with upsert true', async (key) => {
    const _id = key;
    const resp = await collection.findOneAndReplace(
      { _id: _id },
      { age: 13 },
      {
        returnDocument: 'after',
        upsert: true,
      },
    );
    assert.strictEqual(resp?._id, _id);
    assert.strictEqual(resp.age, 13);
  });

  it('should findOneAndReplace with upsert true and returnDocument before', async (key) => {
    const resp = await collection.findOneAndReplace(
      { _id: key },
      { age: 13 },
      {
        returnDocument: 'before',
        upsert: true,
      },
    );
    assert.strictEqual(resp, null);
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
      },
    );
    assert.deepStrictEqual(res, { _id: res?._id });
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
      { projection: { name: 1 }, returnDocument: 'after' },
    );
    assert.strictEqual(res?.name, 'b');
    assert.strictEqual(res.age, undefined);
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
      { sort: { name: 1 } },
    );
    assert.strictEqual(res1?.name, 'a');

    const res2 = await collection.findOneAndReplace(
      { key },
      { name: 'ccc', key },
      { sort: { name: -1 } },
    );
    assert.deepStrictEqual(res2?.name, 'c');
  });

  it('should not return metadata when includeResultMetadata is false', async (key) => {
    await collection.insertOne({ name: 'a', key });

    const res = await collection.findOneAndReplace(
      { name: 'a', key },
      { name: 'b', key },
      { returnDocument: 'after' },
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
      { sort: { $vector: [1, 1, 1, 1, 1] } },
    );
    assert.strictEqual(res?.name, 'a');
  });

  it('should return null if no document is found', async (key) => {
    const res = await collection.findOneAndReplace({ key }, { set: { car: 'bus' } });
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
      const replaced = await collection.findOneAndReplace({ key }, {}, { sort: { name: 1 }, projection: { '*': 1 } });
      assert.deepStrictEqual(replaced, expected[i]);
    }
  });
});
