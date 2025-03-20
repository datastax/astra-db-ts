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

import { DataAPIResponseError, DataAPIVector, ObjectId, UUID } from '@/src/documents/index.js';
import { it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';
import fc from 'fast-check';
import { arbs } from '@/tests/testlib/arbitraries.js';

parallel('integration.documents.collections.insert-one', { truncate: 'colls:before' }, ({ collection }) => {
  it('should insert a document with IDs of all kinds', async () => {
    const ids = [
      'hi',
      null,
      3,
      new ObjectId(),
      UUID.v4(),
      UUID.v7(),
    ];

    const results = await Promise.all(ids.map(async (id) => {
      return await collection.insertOne({ _id: id, value: arbs.one(fc.jsonValue().filter(Boolean)) });
    }));

    assert.deepStrictEqual(ids.map((id) => ({ insertedId: id })), results);
  });

  it('should insertOne document with a non-_id UUID', async () => {
    const id = new ObjectId();
    const res = await collection.insertOne({ foreignId: id });
    assert.ok(res.insertedId);
    const found = await collection.findOne({ foreignId: id });
    assert.ok(found);
    assert.strictEqual(found.foreignId.toString(), id.toString());
  });

  it('should insertOne document with a non-_id ObjectId', async () => {
    const id = new ObjectId();
    const res = await collection.insertOne({ foreignId: id });
    assert.ok(res.insertedId);
    const found = await collection.findOne({ foreignId: id });
    assert.ok(found);
    assert.strictEqual(found.foreignId.toString(), id.toString());
  });

  it('should insertOne with a vector', async (key) => {
    const res = await collection.insertOne({ name: key, $vector: [1, 1, 1, 1, 1] });
    assert.ok(res);
    const found = await collection.findOne({ name: key }, { projection: { '*': 1 } });
    assert.ok(found?.$vector instanceof DataAPIVector);
    assert.deepStrictEqual(found.$vector.asArray(), [1, 1, 1, 1, 1]);
  });

  it('should insertOne with a date', async (key) => {
    const timestamp = new Date();
    const res = await collection.insertOne({ name: key, date: timestamp });
    assert.ok(res);
    const found = await collection.findOne({ name: key });
    assert.ok(found?.date instanceof Date);
    assert.strictEqual(found.date.toISOString(), timestamp.toISOString());
  });

  it('should insertOne with a $date', async (key) => {
    const timestamp = new Date();
    const res = await collection.insertOne({ name: key, date: { $date: timestamp.valueOf() } });
    assert.ok(res);
    const found = await collection.findOne({ name: key });
    assert.ok(found?.date instanceof Date);
    assert.strictEqual(found.date.toISOString(), timestamp.toISOString());
  });

  it('should throw error on serializing bigint', async (key) => {
    await assert.rejects(() => collection.insertOne({
      _id: key,
      answer: 42n,
    }));
  });

  it('should fail insert of doc over size 1 MB', async () => {
    const bigDoc = new Array(1024 * 1024).fill('a').join('');
    const docToInsert = { name: bigDoc };
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
    const docToInsert = { name: longValue };
    await assert.rejects(() => collection.insertOne(docToInsert), DataAPIResponseError);
  });

  it('should fail if an array field size is > 1000', async () => {
    const docToInsert = { tags: new Array(1001).fill('tag') };
    await assert.rejects(() => collection.insertOne(docToInsert), DataAPIResponseError);
  });

  it('should fail if a doc contains more than 1000 properties', async () => {
    const docToInsert: Record<string, string> = {};
    for (let i = 1; i <= 1000; i++) {
      docToInsert[`prop${i}`] = `prop${i}value`;
    }
    await assert.rejects(() => collection.insertOne(docToInsert), DataAPIResponseError);
  });
});
