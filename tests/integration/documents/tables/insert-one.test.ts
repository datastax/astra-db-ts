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
  DataAPIDuration, DataAPIInet,
  DataAPITime,
  DataAPIVector,
  UUID,
} from '@/src/documents';
import { it, parallel } from '@/tests/testlib';
import assert from 'assert';
import BigNumber from 'bignumber.js';

parallel('integration.documents.tables.insert-one', { truncate: 'tables:before' }, ({ table, table_ }) => {
  it('should insert one partial row', async (key) => {
    const inserted = await table.insertOne({
      text: key,
      int: 0,
      map: new Map([[key, UUID.v4()]]),
    });

    assert.deepStrictEqual(inserted, {
      insertedId: { text: key, int: 0 },
    });
  });

  it('should insert one full row', async (key) => {
    const inserted = await table.insertOne({
      text: key,
      int: 0,
      map: new Map([[key, UUID.v4()]]),
      ascii: 'highway_star',
      blob: new DataAPIBlob(Buffer.from('smoke_on_the_water')),
      bigint: 1231233n,
      date: DataAPIDate.now(),
      decimal: BigNumber('12.34567890123456789012345678901234567890'),
      double: 123.456,
      duration: new DataAPIDuration('1d'),
      float: 123.456,
      inet: new DataAPIInet('::1'),
      list: [UUID.v4(), UUID.v7()],
      set: new Set([UUID.v4(), UUID.v7(), UUID.v7()]),
      smallint: 123,
      time: DataAPITime.now(),
      timestamp: new Date(),
      tinyint: 123,
      uuid: UUID.v4(),
      varint: 12312312312312312312312312312312n,
      vector: new DataAPIVector([.123123, .123, .12321, .123123, .2132]),
      boolean: true,
    });

    assert.deepStrictEqual(inserted, {
      insertedId: { text: key, int: 0 },
    });
  });

  it('should insert one full row using raw representations', async (key) => {
    const inserted = await table.insertOne({
      text: key,
      int: 0,
      map: { key: UUID.v4() },
      ascii: 'highway_star',
      blob: { $binary: Buffer.from('smoke_on_the_water').toString('base64') },
      bigint: 1231233,
      date: '2021-01-01',
      double: 123.456,
      duration: '1d',
      float: 123.456,
      inet: '::1',
      list: [UUID.v4(), UUID.v7()],
      set: [UUID.v4(), UUID.v7(), UUID.v7()],
      smallint: 123,
      time: '12:34:56',
      timestamp: '2021-01-01T12:34:56.789Z',
      tinyint: 123,
      uuid: UUID.v4(),
      varint: 12312312312312312312312312312312n,
      vector: [.123123, .123, .12321, .123123, .2132],
      boolean: true,
    } as any);

    assert.deepStrictEqual(inserted, {
      insertedId: { text: key, int: 0 },
    });
  });

  it('should upsert rows', async (key) => {
    const inserted1 = await table.insertOne({
      text: key,
      int: 0,
      map: new Map([[key, UUID.v4()]]),
    });

    assert.deepStrictEqual(inserted1, {
      insertedId: { text: key, int: 0 },
    });

    const inserted2 = await table.insertOne({
      text: key,
      int: 0,
      ascii: 'highway_star',
    });

    assert.deepStrictEqual(inserted2, {
      insertedId: { text: key, int: 0 },
    });
  });

  it('should should insert w/ vectorize', async (key) => {
    const inserted = await table_.insertOne({
      text: key,
      int: 0,
      vector1: "hardest button",
      vector2: "to button",
    });

    assert.deepStrictEqual(inserted, {
      insertedId: { text: key, int: 0 },
    });
  });
});
