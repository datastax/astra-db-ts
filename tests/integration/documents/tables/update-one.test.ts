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

import {
  DataAPIBlob,
  DataAPIDate,
  DataAPIDuration,
  DataAPIResponseError,
  DataAPITime,
  DataAPIVector,
  UUID,
} from '@/src/documents';
import { EverythingTableSchema, it, parallel } from '@/tests/testlib';
import assert from 'assert';
import BigNumber from 'bignumber.js';

parallel('integration.documents.tables.update-one', { truncate: 'colls:before' }, ({ table, table_ }) => {
  it('should error on empty $set/$unset', async () => {
    await assert.rejects(() => table.updateOne({}, { $set: {} }), DataAPIResponseError);
    await assert.rejects(() => table.updateOne({}, { $unset: {} }), DataAPIResponseError);
  });

  it('should error when trying to change pk', async (key) => {
    await assert.rejects(() => table.updateOne({ text: key, int: 0 }, { $set: { text: 'new' } }), DataAPIResponseError);
    await assert.rejects(() => table.updateOne({ text: key, int: 0 }, { $unset: { text: '' } }), DataAPIResponseError);
  });

  // TODO
  // it('should error on upsert being set', async (key) => {
  //   await table.updateOne({ text: key, int: 0 }, { $set: { tinyint: 3 } }, { upsert: true });
  //   await table.updateOne({ text: key, int: 0 }, { $set: { tinyint: 3 } }, { upsert: false });
  // });

  it('should error on sort being set', async (key) => {
    // @ts-expect-error - sort is not a valid option
    await assert.rejects(() => table.updateOne({ text: key, int: 0 }, { $set: { tinyint: 3 } }, { sort: { int: 1 } }), DataAPIResponseError);
    // @ts-expect-error - sort is not a valid option
    await assert.rejects(() => table.updateOne({ text: key, int: 0 }, { $set: { tinyint: 3 } }, { sort: { vector: [.1, .2, .3, .4, .5] } }), DataAPIResponseError);
  });

  it('should error when exact pk not set', async (key) => {
    await assert.rejects(() => table.updateOne({ text: key }, { $set: { tinyint: 3 } }), DataAPIResponseError);
  });

  it('should upsert w/ $set when no matching pk', async (key) => {
    const uuid = UUID.v4();

    const doc = <const>{
      map: new Map([]),
      ascii: 'highway_star',
      blob: new DataAPIBlob(Buffer.from('smoke_on_the_water')),
      bigint: 1231233n,
      date: new DataAPIDate(),
      decimal: BigNumber('12.34567890123456789012345678901234567890'),
      double: 123.456,
      duration: new DataAPIDuration('P1D'),
      float: 123.456,
      inet: '0:0:0:0:0:0:0:1',
      list: [uuid, uuid],
      set: new Set([uuid, uuid, uuid]),
      smallint: 123,
      time: new DataAPITime(),
      timestamp: new Date(),
      tinyint: 123,
      uuid: UUID.v4(),
      varint: 12312312312312312312312312312312n,
      vector: new DataAPIVector([.123123, .123, .12321, .123123, .2132]),
      boolean: true,
    } satisfies Partial<EverythingTableSchema>;

    await table.updateOne({ text: key, int: 0 }, {
      $set: doc,
    });

    const found = await table.findOne({ text: key, int: 0 });

    assert.ok(found);
    assert.strictEqual(Object.keys(found).length, Object.keys(EverythingTableSchema.columns).length);

    assert.strictEqual(found.text, key);
    assert.strictEqual(found.int, 0);
    assert.strictEqual(found.ascii, doc.ascii);
    assert.strictEqual(found.bigint, doc.bigint);
    assert.strictEqual(found.double, doc.double);
    assert.strictEqual(found.float, doc.float);
    assert.strictEqual(found.smallint, doc.smallint);
    assert.strictEqual(found.tinyint, doc.tinyint);
    assert.strictEqual(found.varint, doc.varint);
    assert.strictEqual(found.boolean, doc.boolean);

    assert.ok(found.map);
    assert.strictEqual(found.map.size, doc.map.size);

    assert.ok(found.blob);
    assert.strictEqual(found.blob.asBase64(), doc.blob.asBase64());

    assert.ok(found.date);
    assert.deepStrictEqual(found.date.components(), doc.date.components());

    assert.ok(found.decimal);
    assert.strictEqual(found.decimal.toString(), doc.decimal.toString());

    assert.ok(found.duration);
    assert.strictEqual(found.duration.toString(), doc.duration.toString());

    assert.ok(found.inet);
    assert.strictEqual(found.inet.toString(), doc.inet.toString());

    assert.ok(found.list);
    assert.deepStrictEqual(found.list.map(u => u.toString()), doc.list.map(u => u.toString()));

    assert.ok(found.set);
    assert.strictEqual(found.set.size, 1);
    assert.deepStrictEqual([...found.set].map(u => u.toString()), [...doc.set].map(u => u.toString()));

    assert.ok(found.time);
    assert.deepStrictEqual(found.time.components(), doc.time.components());

    assert.ok(found.timestamp);
    assert.deepStrictEqual(found.timestamp, doc.timestamp);

    assert.ok(found.uuid);
    assert.ok(found.uuid.equals(doc.uuid));

    assert.ok(found.vector);
    assert.deepStrictEqual(found.vector.asArray(), doc.vector.asArray());
  });

  it('should not upsert w/ $unset/null-$set when no matching pk', async (key) => {
    await table.updateOne({ text: key, int: 0 }, {
      $unset: { tinyint: '' },
    });

    const found1 = await table.findOne({ text: key, int: 0 });
    assert.strictEqual(found1, null);

    await table.updateOne({ text: key, int: 0 }, {
      $set: { tinyint: null },
    });

    const found2 = await table.findOne({ text: key, int: 0 });
    assert.strictEqual(found2, null);
  });

  it('should error if $in is used', async (key) => {
    await assert.rejects(() => table.updateOne({ text: key, int: { $in: [1, 2, 3] } }, { $set: { tinyint: 3 } }), DataAPIResponseError);
  });

  it('should upsert w/ vectorize', async (key) => {
    const vector = Array.from({ length: 1024 }, () => .1);

    await table_.updateOne({ text: key, int: 0 }, {
      $set: { vector1: "hello world!!!", vector2: new DataAPIVector(vector) },
    });

    const found = await table_.findOne({ text: key, int: 0 });
    assert.ok(found?.vector1 instanceof DataAPIVector);
    assert.deepStrictEqual((found?.vector2 as DataAPIVector).asArray(), vector);
    assert.strictEqual(found?.text, key);
  });

  it('should $set one', async (key) => {
    await table.insertOne({ text: key, int: 0, tinyint: 3 });

    await table.updateOne({ text: key, int: 0 }, {
      $set: { tinyint: 4 },
    });

    const found = await table.findOne({ text: key, int: 0 });
    assert.strictEqual(found?.tinyint, 4);
    assert.strictEqual(found?.text, key);
  });

  it('should $set one after being upserted', async (key) => {
    await table.updateOne({ text: key, int: 0 }, {
      $set: { tinyint: 3 },
    });

    await table.updateOne({ text: key, int: 0 }, {
      $set: { tinyint: 4 },
    });

    const found = await table.findOne({ text: key, int: 0 });
    assert.strictEqual(found?.tinyint, 4);
    assert.strictEqual(found?.text, key);
  });

  it('should $unset one', async (key) => {
    await table.insertOne({ text: key, int: 0, tinyint: 3 });

    await table.updateOne({ text: key, int: 0 }, {
      $unset: { tinyint: '' },
    });

    const found = await table.findOne({ text: key, int: 0 });
    assert.strictEqual(found?.tinyint, null);
    assert.strictEqual(found?.text, key);
  });
});
