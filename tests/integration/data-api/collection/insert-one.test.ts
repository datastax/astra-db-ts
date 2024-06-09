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

import { Collection, DataAPIResponseError, ObjectId, UUID } from '@/src/data-api';
import { initTestObjects } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.insert-one', () => {
  let collection: Collection;

  before(async function () {
    [, , collection] = await initTestObjects(this);
  });

  beforeEach(async () => {
    await collection.deleteAll();
  });

  it('should insertOne document', async () => {
    const res = await collection.insertOne({ name: 'Lzzy' });
    assert.ok(res);
    assert.ok(typeof res.insertedId as any === 'string');
    assert.doesNotThrow(() => new UUID(<any>res.insertedId));
  });

  it('should insertOne document with id', async () => {
    const res = await collection.insertOne({ name: 'Lzzy', _id: '123' });
    assert.ok(res);
    assert.ok(res.insertedId, '123');
  });

  it('should insertOne document with a null id', async () => {
    const res = await collection.insertOne({ name: 'Lzzy', _id: null });
    assert.ok(res);
    assert.strictEqual(res.insertedId, null);
    const found = await collection.findOne({ _id: null });
    assert.strictEqual(found?.name, 'Lzzy');
  });

  it('should insertOne document with a UUID', async () => {
    const id = UUID.v7();
    const res = await collection.insertOne({ _id: id });
    assert.ok(res);
    assert.strictEqual(res.insertedId?.toString(), id.toString());
  });

  it('should insertOne document with an ObjectId', async () => {
    const id = new ObjectId();
    const res = await collection.insertOne({ _id: id });
    assert.ok(res);
    assert.strictEqual(res.insertedId?.toString(), id.toString());
  });

  it('should insertOne document with a non-_id UUID', async () => {
    const id = new ObjectId();
    const res = await collection.insertOne({ foreignId: id });
    assert.ok(res.insertedId);
    const found = await collection.findOne({ foreignId: id });
    assert.ok(found);
    assert.strictEqual(found?.foreignId.toString(), id.toString());
  });

  it('should insertOne document with a non-_id ObjectId', async () => {
    const id = new ObjectId();
    const res = await collection.insertOne({ foreignId: id });
    assert.ok(res.insertedId);
    const found = await collection.findOne({ foreignId: id });
    assert.ok(found);
    assert.strictEqual(found?.foreignId.toString(), id.toString());
  });

  it('should insertOne with vector', async () => {
    const res = await collection.insertOne({ name: 'Arch Enemy' }, { vector: [1, 1, 1, 1, 1] });
    assert.ok(res);
    const found = await collection.findOne({ name: 'Arch Enemy' });
    assert.deepStrictEqual(found?.$vector, [1, 1, 1, 1, 1]);
  });

  it('should insertOne with $date', async () => {
    const timestamp = new Date();
    const res = await collection.insertOne({ name: 'Hot Fuzz', date: { $date: timestamp } });
    assert.ok(res);
    const found = await collection.findOne({ name: 'Hot Fuzz' });
    assert.ok(found?.date instanceof Date);
    assert.strictEqual(found?.date.toISOString(), timestamp.toISOString());
  });

  it('should store bigint as number', async () => {
    await collection.insertOne({
      _id: 'bigint-test',
      answer: 42n
    });

    const res = await collection.findOne({ _id: 'bigint-test' });
    assert.strictEqual(res!.answer, 42);
  });

  it('should fail when inserting with both vector and vectorize', async () => {
    await assert.rejects(() => collection.insertOne({ name: 'Arch Enemy' }, { vector: [1, 1, 1, 1, 1], vectorize: 'Arch Enemy' }), Error);
  });

  it('should fail insert of doc over size 1 MB', async () => {
    const bigDoc = new Array(1024 * 1024).fill('a').join('');
    const docToInsert = { username: bigDoc };
    await assert.rejects(() => collection.insertOne(docToInsert), Error);
  });

  it('should fail if the number of levels in the doc is > 16', async () => {
    const docToInsert = {
      l1: { l2: { l3: { l4: { l5: { l6: { l7: { l8: { l9: { l10: { l11: { l12: { l13: { l14: { l15: { l16: { l17: 'l17value' } } } } } } } } } } } } } } } },
    };
    await assert.rejects(() => collection.insertOne(docToInsert), DataAPIResponseError);
  });

  it('should fail if the field length is > 1000', async () => {
    const fieldName = 'a'.repeat(1001);
    const docToInsert = { [fieldName]: 'value' };
    await assert.rejects(() => collection.insertOne(docToInsert), DataAPIResponseError);
  });

  it('should fail if the string field value is > 8000', async () => {
    const longValue = new Array(8001).fill('a').join('');
    const docToInsert = { username: longValue };
    await assert.rejects(() => collection.insertOne(docToInsert), DataAPIResponseError);
  });

  it('should fail if an array field size is > 1000', async () => {
    const docToInsert = { tags: new Array(1001).fill('tag') };
    await assert.rejects(() => collection.insertOne(docToInsert), DataAPIResponseError);
  });

  it('should fail if a doc contains more than 1000 properties', async () => {
    const docToInsert: any = { _id: '123' };
    for (let i = 1; i <= 1000; i++) {
      docToInsert[`prop${i}`] = `prop${i}value`;
    }
    await assert.rejects(() => collection.insertOne(docToInsert), DataAPIResponseError);
  });
});
