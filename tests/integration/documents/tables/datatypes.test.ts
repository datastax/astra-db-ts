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

import type {
  DataAPIBlob, DataAPIInet,
  DataAPIVector,
  SomeRow,
  Table} from '@/src/documents/index.js';
import {
  blob,
  DataAPIResponseError,
  date,
  duration, inet,
  time,
  uuid,
  vector,
} from '@/src/documents/index.js';
import { it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';
import { BigNumber } from 'bignumber.js';

parallel('integration.documents.tables.datatypes', ({ table, table_ }) => {
  interface ColumnAsserterOpts<T> {
    eqOn?: (a: T) => unknown;
    table?: Table<SomeRow>;
  }

  const mkColumnAsserter = <T>(key: string, col: string, opts?: ColumnAsserterOpts<T>) => ({
    _counter: 0,
    _table: opts?.table ?? table,
    _eqOn: opts?.eqOn ?? (x => x),
    async ok<Exp>(value: Exp, mapExp: (ex: Exp) => T = (x => x as unknown as T)) {
      const obj = { text: key, int: this._counter++, [col]: value };
      const pkey = { text: obj.text, int: obj.int };
      assert.deepStrictEqual(await this._table.insertOne(obj), { insertedId: pkey });
      assert.deepStrictEqual(this._eqOn((await this._table.findOne(pkey) as any)?.[col]), this._eqOn(mapExp(obj[col] as any)));
    },
    async notOk(value: unknown, err = DataAPIResponseError) {
      const obj = { text: key, int: this._counter++, [col]: value };
      await assert.rejects(() => this._table.insertOne(obj), err);
    },
  });

  it('should handle different text insertion cases', async (key) => {
    const colAsserter = mkColumnAsserter<string>(key, 'text');

    await colAsserter.notOk('');
    await colAsserter.notOk('a'.repeat(65536));

    await colAsserter.ok('a'.repeat(65535));
    await colAsserter.ok('A!@#$%^&*()');
    await colAsserter.ok('⨳⨓⨋');
  });

  (['int', 'tinyint', 'smallint'] as const).map((col) =>
    it(`should handle different ${col} insertion cases`, async (key) => {
      const colAsserter = mkColumnAsserter(key, col);

      await colAsserter.notOk(1.1);
      await colAsserter.notOk(1e50);
      await colAsserter.notOk(Infinity);
      await colAsserter.notOk(NaN);
      await colAsserter.notOk('Infinity');
      await colAsserter.notOk('123');

      await colAsserter.ok(+1);
      await colAsserter.ok(-1);
    }));

  it('should handle different ascii insertion cases', async (key) => {
    const colAsserter = mkColumnAsserter(key, 'ascii');

    await colAsserter.notOk('⨳⨓⨋');
    await colAsserter.notOk('é');
    await colAsserter.notOk('\x80');

    await colAsserter.ok('');
    await colAsserter.ok('a'.repeat(65535));
    await colAsserter.ok('A!@#$%^&*()');
    await colAsserter.ok('\u0000');
    await colAsserter.ok('\x7F');
  });

  it('should handle different blob insertion cases', async (key) => {
    const buffer = blob(Buffer.from([0x0, 0x1]));
    const base64 = blob({ $binary: buffer.asBase64() });
    const arrBuf = blob(buffer.asArrayBuffer());

    const colAsserter = mkColumnAsserter(key, 'blob', {
      eqOn: (blob: DataAPIBlob) => blob.asBase64(),
    });

    await colAsserter.notOk(base64.asBase64());
    await colAsserter.notOk(buffer.asBuffer());
    await colAsserter.notOk(arrBuf.asArrayBuffer());

    await colAsserter.ok(base64.raw(), _ => base64);
    await colAsserter.ok(base64,       _ => base64);
    await colAsserter.ok(buffer,       _ => base64);
    await colAsserter.ok(arrBuf,       _ => base64);
  });

  it('should handle the numerous different boolean insertion cases', async (key) => {
    const colAsserter = mkColumnAsserter(key, 'boolean');

    await colAsserter.notOk('true');
    await colAsserter.notOk(1);

    await colAsserter.ok(true);
    await colAsserter.ok(false);
  });

  it('should handle different decimal insertion cases', async (key) => {
    const colAsserter = mkColumnAsserter(key, 'decimal');

    // await colAsserter.notOk('123123.12312312312');
    await colAsserter.notOk(BigNumber('NaN'));
    // await colAsserter.notOk(BigNumber('Infinity'));
    // await colAsserter.notOk(BigNumber('-Infinity'));
    // await colAsserter.notOk(NaN);
    // await colAsserter.notOk(Infinity);
    // await colAsserter.notOk(-Infinity);
    //
    // await colAsserter.ok(123123.123, BigNumber);
    // await colAsserter.ok(123123n, n => BigNumber(n.toString()));
    // await colAsserter.ok(BigNumber('1.1212121131231231231231231231231231231231233122'));
    // await colAsserter.ok(BigNumber('-1e50'));
    // await colAsserter.ok(BigNumber('-1e-50'));
  });

  (['float', 'double'] as const).map((col) =>
    it(`should handle different ${col} insertion cases`, async (key) => {
      const colAsserter = mkColumnAsserter(key, col);

      await colAsserter.notOk('123');
      await colAsserter.notOk('nan');
      await colAsserter.notOk('infinity');

      await colAsserter.ok(123123.125);
      await colAsserter.ok(123123n, Number);
      await colAsserter.ok(BigNumber('1.34234'), ex => ex.toNumber());
      await colAsserter.ok(NaN);
      await colAsserter.ok(Infinity);
      await colAsserter.ok(-Infinity);
      await colAsserter.ok('-Infinity', parseFloat);
    }));

  (['bigint', 'varint'] as const).map((col) =>
    it(`should handle different ${col} insertion cases`, async (key) => {
      const colAsserter = mkColumnAsserter(key, col);

      await colAsserter.notOk('123');
      await colAsserter.notOk(NaN);
      await colAsserter.notOk(Infinity);
      await colAsserter.notOk(-Infinity);

      await colAsserter.ok(123123, BigInt);
      await colAsserter.ok((2n ** 63n) - 1n);
      await colAsserter.ok(BigNumber('23423432049238904'), ex => BigInt(ex.toString()));
    }));

  it('should handle different inet insertion cases', async (key) => {
    const colAsserter = mkColumnAsserter(key, 'inet', {
      eqOn: (a: DataAPIInet) => a.toString(),
    });

    await colAsserter.notOk('127.0.0.1/16');
    await colAsserter.notOk('127.0.0.1:80');
    await colAsserter.notOk('6f4e:1900:4545:3:200:f6ff:fe21:645cf');
    await colAsserter.notOk('10.10.10.1000');

    await colAsserter.ok('::ffff:192.168.0.1', _ => inet('192.168.0.1'));
    await colAsserter.ok('127.1',              _ => inet('127.0.0.1'));
    await colAsserter.ok('127.0.1',            _ => inet('127.0.0.1'));
    await colAsserter.ok('localhost',          _ => inet('127.0.0.1'));
    await colAsserter.ok('192.168.36095',      _ => inet('192.168.140.255'));
    await colAsserter.ok('192.11046143',       _ => inet('192.168.140.255'));

    await colAsserter.ok(inet('127.0.0.1'));
    await colAsserter.ok(inet('::1'),                                     _ => inet('0:0:0:0:0:0:0:1'));
    await colAsserter.ok(inet('2001:0db8:85a3:0000:0000:8a2e:0370:7334'), _ => inet('2001:db8:85a3:0:0:8a2e:370:7334'));
    await colAsserter.ok(inet('2001:db8:85a3::8a2e:370:7334'),            _ => inet('2001:db8:85a3:0:0:8a2e:370:7334'));
    await colAsserter.ok(inet('168.201.203.205'));
  });

  it('should handle different vector insertion cases', async (key) => {
    const colAsserter = mkColumnAsserter(key, 'vector', {
      eqOn: (a: DataAPIVector) => a.asArray(),
    });

    await colAsserter.notOk('hey, wait, this ain\'t vectorize...');
    await colAsserter.notOk(vector([.5, .5, .5, .5, .5, .5]));

    await colAsserter.ok(vector([.5, .5, .5, .5, .5]));
    await colAsserter.ok([.5, .5, .5, .5, .5], vector);
  });

  it('should handle different vectorize insertion cases', async (key) => {
    const dummyVec = vector(Array.from({ length: 1024 }, () => .5));

    const colAsserter = mkColumnAsserter(key, 'vector1', {
      eqOn: (a: DataAPIVector) => a.length,
      table: table_,
    });

    await colAsserter.notOk(vector([.5, .5, .5, .5, .5]));

    await colAsserter.ok('toto, I\'ve a feeling we\'re in vectorize again', _ => dummyVec);
    await colAsserter.ok(dummyVec);
  });

  it('should handle different map insertion cases', async (key) => {
    const uuid1 = uuid(1);
    const uuid4 = uuid(4);

    const colAsserter = mkColumnAsserter(key, 'map');

    await colAsserter.notOk([]);
    await colAsserter.notOk([['a', uuid(4)]]);
    await colAsserter.notOk(new Map(<any>[['a', uuid1], ['b', 'uuid4']]));

    for (const val of [null, undefined, {}, new Map()]) {
      await colAsserter.ok(val, _ => new Map());
    }

    await colAsserter.ok({ a: uuid1.toString(), b: uuid4 }, _ => new Map([['a', uuid1], ['b', uuid4]]));
    await colAsserter.ok(new Map(<any>[['a', uuid1.toString()], ['b', uuid4]]), _ => new Map([['a', uuid1], ['b', uuid4]]));
    await colAsserter.ok(new Map([['⨳⨓⨋', uuid1]]));
    await colAsserter.ok(new Map([['a'.repeat(50000), uuid1]]));
    await colAsserter.ok(new Map(Array.from({ length: 1000 }, (_, i) => [i.toString(), uuid(7)])));
  });

  it('should handle different set insertion cases', async (key) => {
    const uuid1 = uuid(1);
    const uuid4 = uuid(4);

    const colAsserter = mkColumnAsserter(key, 'set');

    await colAsserter.notOk({});
    await colAsserter.notOk(new Set([uuid1, 'uuid4']));

    for (const val of [null, undefined, [], new Set()]) {
      await colAsserter.ok(val, _ => new Set());
    }

    await colAsserter.ok([uuid1.toString(), uuid4], _ => new Set([uuid1, uuid4]));
    await colAsserter.ok(new Set([uuid1.toString(), uuid4]), _ => new Set([uuid1, uuid4]));
    await colAsserter.ok([uuid1, uuid1, uuid4], _ => new Set([uuid1, uuid4]));
    await colAsserter.ok(new Set(Array.from({ length: 1000 }, () => uuid(7))));
  });

  it('should handle different list insertion cases', async (key) => {
    const uuid1 = uuid(1);
    const uuid4 = uuid(4);

    const colAsserter = mkColumnAsserter(key, 'list');

    await colAsserter.notOk({});
    await colAsserter.notOk([uuid1, 'uuid4']);

    for (const val of [null, undefined, []]) {
      await colAsserter.ok(val, _ => []);
    }

    await colAsserter.ok([uuid1.toString(), uuid1, uuid1, uuid4], _ => [uuid1, uuid1, uuid1, uuid4]);
    await colAsserter.ok(new Array(1000).fill(uuid(7)));
  });

  it('should handle different time insertion cases', async (key) => {
    const colAsserter = mkColumnAsserter(key, 'time');

    await colAsserter.notOk('24:00:00');
    await colAsserter.notOk('00:60:00');
    await colAsserter.notOk('00:00:00.0000000000');
    await colAsserter.notOk('1:00:00');
    await colAsserter.notOk('-01:00:00');
    await colAsserter.notOk('23-59-00');
    await colAsserter.notOk('12:34:56Z+05:30');
    await colAsserter.notOk(3123123);

    await colAsserter.ok('23:59:00.', _ => time('23:59:00')); // S
    await colAsserter.ok('23:59',     _ => time('23:59:00')); // S
    await colAsserter.ok('00:00:00.000000000', time);
    await colAsserter.ok(time('23:59:59.999999999'));
    await colAsserter.ok(time(new Date('1970-01-01T23:59:59.999')), _ => time('23:59:59.999'));
    // await colAsserter.ok(time({ hours: 23, minutes: 59, seconds: 59 }));
    // await colAsserter.ok(time({ hours: 23, minutes: 59, seconds: 59, nanoseconds: 120012 }));
  });

  it('should handle different date insertion cases', async (key) => {
    const colAsserter = mkColumnAsserter(key, 'date');

    await colAsserter.notOk('+2000-01-01');

    await colAsserter.ok('0000-01-01', date);
    await colAsserter.ok('1970-01-01', date);
    await colAsserter.ok('-0001-01-01', date);
    await colAsserter.ok(date('9999-12-31'));
    await colAsserter.ok(date('+500000-12-31'));
    await colAsserter.ok(date('-500000-12-31'));
    await colAsserter.ok(date(new Date('1970-01-01T23:59:59.999')), _ => date('1970-01-01'));
    await colAsserter.ok(date(1970, 1, 1));
  });

  it('should handle different timestamp insertion cases', async (key) => {
    const colAsserter = mkColumnAsserter(key, 'timestamp');

    await colAsserter.notOk(3123123);

    await colAsserter.ok(new Date());
    await colAsserter.ok(new Date('1970-01-01T00:00:00.000Z'));
    await colAsserter.ok('1970-01-01T00:00:00.000+07:00', _ => new Date('1970-01-01T00:00:00.000+07:00'));
  });

  it('should handle different duration insertion cases', async (key) => {
    const colAsserter = mkColumnAsserter(key, 'duration');

    await colAsserter.notOk('1 hour');

    await colAsserter.ok('1h', duration);
  });
});
