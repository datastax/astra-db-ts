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
  CqlBlob,
  CqlDate,
  CqlDuration,
  CqlTime,
  CqlTimestamp,
  DataAPIVector,
  InetAddress,
  UUID,
} from '@/src/documents';
import { EverythingTableSchema, it, parallel } from '@/tests/testlib';
import assert from 'assert';
import BigNumber from 'bignumber.js';

parallel('integration.documents.tables.find-one', { truncate: 'colls:before', drop: 'tables:after' }, ({ table }) => {
  it('should find one partial row', async (key) => {
    const uuid = UUID.v4();

    const doc = <const>{
      text: key,
      int: 0,
      map: new Map([['key', uuid]]),
    } satisfies EverythingTableSchema;

    const inserted = await table.insertOne(doc);
    const found = await table.findOne(inserted.insertedId);

    assert.ok(found);
    assert.strictEqual(Object.keys(found).length, Object.keys(EverythingTableSchema.columns).length);

    assert.strictEqual(found.text, doc.text);
    assert.strictEqual(found.int, doc.int);

    assert.ok(found.map);
    assert.deepStrictEqual([...found.map.keys()], [...doc.map.keys()]);
    assert.ok(found.map.get('key')?.equals(doc.map.get('key')));

    for (const key of Object.keys(found)) {
      switch (key) {
        case 'text':
        case 'int':
        case 'map':
          continue;
        case 'set':
          assert.ok(found.set instanceof Set);
          assert.strictEqual(found.set.size, 0);
          break;
        case 'list':
          assert.ok(Array.isArray(found.list));
          assert.strictEqual(found.list.length, 0);
          break;
        default:
          assert.strictEqual(found[key as keyof typeof found], null, key);
      }
    }
  });

  it('should find one full row', async (key) => {
    const uuid = UUID.v4();

    const doc = <const>{
      text: key,
      int: 0,
      map: new Map([]),
      ascii: 'highway_star',
      blob: new CqlBlob(Buffer.from('smoke_on_the_water')),
      bigint: 1231233,
      date: new CqlDate(),
      decimal: BigNumber('12.34567890123456789012345678901234567890'),
      double: 123.456,
      duration: new CqlDuration('P1D'),
      float: 123.456,
      inet: new InetAddress('0:0:0:0:0:0:0:1'),
      list: [uuid, uuid],
      set: new Set([uuid, uuid, uuid]),
      smallint: 123,
      time: new CqlTime(),
      timestamp: new CqlTimestamp(),
      tinyint: 123,
      uuid: UUID.v4(),
      varint: 12312312312312312312312312312312n,
      vector: new DataAPIVector([.123123, .123, .12321, .123123, .2132]),
      boolean: true,
    } satisfies EverythingTableSchema;

    const inserted = await table.insertOne(doc);
    const found = await table.findOne(inserted.insertedId);

    assert.ok(found);
    assert.strictEqual(Object.keys(found).length, Object.keys(EverythingTableSchema.columns).length);

    assert.strictEqual(found.text, doc.text);
    assert.strictEqual(found.int, doc.int);
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
    assert.deepStrictEqual(found.timestamp.components(), doc.timestamp.components());

    assert.ok(found.uuid);
    assert.ok(found.uuid.equals(doc.uuid));

    assert.ok(found.vector);
    assert.deepStrictEqual(found.vector.asArray(), doc.vector.asArray());
  });
});
