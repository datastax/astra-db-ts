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
  DataAPITimestamp,
  DataAPIVector,
  InetAddress,
  UUID,
} from '@/src/documents';
import { it, parallel, describe } from '@/tests/testlib';
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
      bigint: 1231233,
      date: new DataAPIDate(),
      decimal: BigNumber('12.34567890123456789012345678901234567890'),
      double: 123.456,
      duration: new DataAPIDuration('1d'),
      float: 123.456,
      inet: new InetAddress('::1'),
      list: [UUID.v4(), UUID.v7()],
      set: new Set([UUID.v4(), UUID.v7(), UUID.v7()]),
      smallint: 123,
      time: new DataAPITime(),
      timestamp: new DataAPITimestamp(),
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

  describe('scalar inserts (group #1)', ({ db }) => {
    it('should handle different text insertion cases', async () => {
      await assert.rejects(() => table.insertOne({ text: '', int: 0 }), DataAPIResponseError);

      assert.deepStrictEqual(
        await table.insertOne({ text: '⨳⨓⨋', int: 0 }),
        { insertedId: { text: '⨳⨓⨋', int: 0 } },
      );

      assert.deepStrictEqual(
        await table.insertOne({ text: 'a'.repeat(65535), int: 0 }),
        { insertedId: { text: 'a'.repeat(65535), int: 0 } },
      );

      await assert.rejects(() => table.insertOne({ text: 'a'.repeat(65536), int: 0 }), DataAPIResponseError);
    });

    it('should handle different different int insertion cases', async () => {
      await Promise.all(['int', 'tinyint', 'smallint', 'bigint'].map(async (col) => {
        const table = await db.createTable(`temp_${col}`, { definition: { columns: { intT: col }, primaryKey: 'intT' } });

        await assert.rejects(() => table.insertOne({ intT: 1.1 }), DataAPIResponseError, col);
        await assert.rejects(() => table.insertOne({ intT: 1e50 }), DataAPIResponseError, col);
        await assert.rejects(() => table.insertOne({ intT: Infinity }), DataAPIResponseError, col);
        await assert.rejects(() => table.insertOne({ intT: NaN }), DataAPIResponseError, col);
        await assert.rejects(() => table.insertOne({ intT: 'Infinity' as any }), DataAPIResponseError, col);
        await assert.rejects(() => table.insertOne({ intT: '123' as any }), DataAPIResponseError, col);

        assert.deepStrictEqual(await table.insertOne({ intT: +1 }), { insertedId: { intT: +1 } }, col);
        assert.deepStrictEqual(await table.insertOne({ intT: -1 }), { insertedId: { intT: -1 } }, col);

        await table.drop();
      }));
    });
  });

  describe('scalar inserts (group #2)', ({ db }) => {
    it('should handle different ascii insertion cases', async () => {
      const table = await db.createTable('temp_ascii', { definition: { columns: { ascii: 'ascii' }, primaryKey: 'ascii' } });

      await assert.rejects(() => table.insertOne({ ascii: '' }), DataAPIResponseError);
      await assert.rejects(() => table.insertOne({ ascii: '⨳⨓⨋' }), DataAPIResponseError);
      await assert.rejects(() => table.insertOne({ ascii: 'é' }), DataAPIResponseError);
      await assert.rejects(() => table.insertOne({ ascii: '\x80' }), DataAPIResponseError);

      assert.deepStrictEqual(
        await table.insertOne({ ascii: 'a'.repeat(65535) }),
        { insertedId: { ascii: 'a'.repeat(65535) } },
      );

      assert.deepStrictEqual(
        await table.insertOne({ ascii: 'A!@#$%^&*()' }),
        { insertedId: { ascii: 'A!@#$%^&*()' } },
      );

      assert.deepStrictEqual(
        await table.insertOne({ ascii: '\u0000' }),
        { insertedId: { ascii: '\u0000' } },
      );

      assert.deepStrictEqual(
        await table.insertOne({ ascii: '\x7F' }),
        { insertedId: { ascii: '\x7F' } },
      );

      await table.drop();
    });

    it('should handle different blob insertion cases', async () => {
      const table = await db.createTable('temp_blob', { definition: { columns: { blob: 'blob' }, primaryKey: 'blob' } });
      const buffer = Buffer.from([0x0, 0x1]);
      const base64 = buffer.toString('base64');

      await assert.rejects(() => table.insertOne({ blob: buffer as any }), DataAPIResponseError);

      assert.deepStrictEqual(
        (await table.insertOne({ blob: { $binary: base64 } as any })).insertedId.blob.asBase64(),
        base64,
      );

      assert.deepStrictEqual(
        (await table.insertOne({ blob: new DataAPIBlob(buffer) })).insertedId.blob.asBase64(),
        base64,
      );

      await table.drop();
    });

    it('should handle different boolean insertion cases (I mean, not that there are many lol)', async () => {
      const table = await db.createTable('temp_boolean', { definition: { columns: { boolean: 'boolean' }, primaryKey: 'boolean' } });

      await assert.rejects(() => table.insertOne({ boolean: 'true' as any }), DataAPIResponseError);
      await assert.rejects(() => table.insertOne({ boolean: 1 as any }), DataAPIResponseError);

      assert.deepStrictEqual(
        await table.insertOne({ boolean: true }),
        { insertedId: { boolean: true } },
      );

      assert.deepStrictEqual(
        await table.insertOne({ boolean: false }),
        { insertedId: { boolean: false } },
      );

      await table.drop();
    });

    it('should handle different date insertion cases', async () => {
      const table = await db.createTable('temp_date', { definition: { columns: { date: 'date' }, primaryKey: 'date' } });

      await assert.rejects(() => table.insertOne({ date: new DataAPIDate('2000-00-06') }), DataAPIResponseError);
      await assert.rejects(() => table.insertOne({ date: new DataAPIDate('2000-01-00') }), DataAPIResponseError);
      await assert.rejects(() => table.insertOne({ date: new DataAPIDate('2000/01/01') }), DataAPIResponseError);
      await assert.rejects(() => table.insertOne({ date: new DataAPIDate('2000-01-32') }), DataAPIResponseError);
      await assert.rejects(() => table.insertOne({ date: new DataAPIDate('2000-02-30') }), DataAPIResponseError);
      await assert.rejects(() => table.insertOne({ date: new DataAPIDate('+2000-00-06') }), DataAPIResponseError);
      await assert.rejects(() => table.insertOne({ date: new DataAPIDate('-0000-00-06') }), DataAPIResponseError);
      await assert.rejects(() => table.insertOne({ date: new DataAPIDate('10000-00-06') }), DataAPIResponseError);

      assert.deepStrictEqual(
        (await table.insertOne({ date: '1970-01-01' as any })).insertedId.date.toString(),
        '1970-01-01',
      );

      assert.deepStrictEqual(
        (await table.insertOne({ date: new DataAPIDate('-0001-01-01') })).insertedId.date.toString(),
        '-0001-01-01',
      );

      assert.deepStrictEqual(
        (await table.insertOne({ date: new DataAPIDate('9999-12-31') })).insertedId.date.toString(),
        '9999-12-31',
      );

      assert.deepStrictEqual(
        (await table.insertOne({ date: new DataAPIDate('+10000-12-31') })).insertedId.date.toString(),
        '+10000-12-31',
      );

      assert.deepStrictEqual(
        (await table.insertOne({ date: new DataAPIDate('-10000-12-31') })).insertedId.date.toString(),
        '-10000-12-31',
      );

      await table.drop();
    });
  });

  describe('scalar inserts (group #3)', ({ db }) => {
    it('should handle different decimal insertion cases', async () => {
      const table = await db.createTable('temp_decimal', { definition: { columns: { decimal: 'decimal' }, primaryKey: 'decimal' } });

      await assert.rejects(() => table.insertOne({ decimal: '123123.12312312312' as any }), DataAPIResponseError);
      await assert.rejects(() => table.insertOne({ decimal: BigNumber('NaN') }), DataAPIResponseError);
      await assert.rejects(() => table.insertOne({ decimal: BigNumber('Infinity') }), DataAPIResponseError);
      await assert.rejects(() => table.insertOne({ decimal: BigNumber('-Infinity') }), DataAPIResponseError);

      assert.deepStrictEqual(
        await table.insertOne({ decimal: 123123.123 as any }),
        { insertedId: { decimal: BigNumber('123123.123') } },
      );

      assert.deepStrictEqual(
        await table.insertOne({ decimal: 123123n as any }),
        { insertedId: { decimal: BigNumber('123123') } },
      );

      assert.deepStrictEqual(
        await table.insertOne({ decimal: BigNumber('1.1212121131231231231231231231231231231231233122') }),
        { insertedId: { decimal: BigNumber('1.1212121131231231231231231231231231231231233122') } },
      );

      assert.deepStrictEqual(
        await table.insertOne({ decimal: BigNumber('-1e50') }),
        { insertedId: { decimal: BigNumber('-1e50') } },
      );

      assert.deepStrictEqual(
        await table.insertOne({ decimal: BigNumber('-1e-50') }),
        { insertedId: { decimal: BigNumber('-1e-50') } },
      );

      await table.drop();
    });

    it('should handle different iee754 insertion cases', async () => {
      await Promise.all(['float', 'double'].map(async (col) => {
        const table = await db.createTable(`temp_${col}`, { definition: { columns: { ieeT: col }, primaryKey: 'ieeT' } });

        await assert.rejects(() => table.insertOne({ ieeT: '123' as any }), DataAPIResponseError, col);

        assert.deepStrictEqual(
          await table.insertOne({ ieeT: 123123.125 }),
          { insertedId: { ieeT: 123123.125 } },
        );

        assert.deepStrictEqual(
          await table.insertOne({ ieeT: 123123n }),
          { insertedId: { ieeT: 123123 } },
        );

        assert.notDeepStrictEqual(
          BigNumber((await table.insertOne({ ieeT: BigNumber('1.122121312312122212121213123') })).insertedId.ieeT as number),
          BigNumber('1.122121312312122212121213123'),
        );

        assert.deepStrictEqual(
          await table.insertOne({ ieeT: NaN }),
          { insertedId: { ieeT: NaN } },
        );

        assert.deepStrictEqual(
          await table.insertOne({ ieeT: 'NaN' }),
          { insertedId: { ieeT: NaN } },
        );

        assert.deepStrictEqual(
          await table.insertOne({ ieeT: Infinity }),
          { insertedId: { ieeT: Infinity } },
        );

        assert.deepStrictEqual(
          await table.insertOne({ ieeT: -Infinity }),
          { insertedId: { ieeT: -Infinity } },
        );

        await table.drop();
      }));
    });

    // it('should handle different duration insertion cases', () => {
    //   const table = db.createTable('temp_duration', { definition: { columns: { duration: 'duration' }, primaryKey: 'duration' } });
    //
    // });
  });

  // describe('scalar inserts (group #3)', ({ db }) => {
  //   it('should handle different vector insertion cases', async () => {
  //     const table = await db.createTable('temp_vector', { definition: { columns: { vector: { type: 'vector', dimension: 3 } }, primaryKey: 'vector' } });
  //
  //     await assert.rejects(() => table.insertOne({ vector: "this ain't vectorize" as any }), DataAPIResponseError);
  //
  //     assert.deepStrictEqual(
  //       (await table.insertOne({ vector: [.5, .5, .5] as any })).insertedId.vector.asArray(),
  //       [.5, .5, .5],
  //     );
  //
  //     assert.deepStrictEqual(
  //       (await table.insertOne({ vector: new DataAPIVector([.5, .5, .5]) })).insertedId.vector.asArray(),
  //       [.5, .5, .5],
  //     );
  //
  //     await table.drop();
  //   });
  //
  //   it('should handle different vectorize insertion cases', async () => {
  //     const table = await db.createTable('temp_vectorize', {
  //       definition: {
  //         columns: {
  //           vector1: { type: 'vector', dimension: 1024, service: { provider: 'nvidia', modelName: 'NV-Embed-QA' } },
  //           vector2: { type: 'vector', dimension: 1024, service: { provider: 'nvidia', modelName: 'NV-Embed-QA' } },
  //         },
  //         primaryKey: {
  //           partitionBy: ['vector1'],
  //           partitionSort: { vector2: 1 },
  //         },
  //       },
  //     });
  //
  //     const inserted1 = await table.insertOne({ vector1: "would you do it with me?", vector2: "heal the scars and change the stars..." });
  //     assert.strictEqual((inserted1.insertedId.vector1 as DataAPIVector).asArray().length, 1024);
  //     assert.strictEqual((inserted1.insertedId.vector2 as DataAPIVector).asArray().length, 1024);
  //
  //     await table.drop();
  //   });
  // });
});
