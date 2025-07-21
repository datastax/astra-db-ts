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

import assert from 'assert';
import { DataAPITime, date, time } from '@/src/documents/index.js';
import { describe, it } from '@/tests/testlib/index.js';
import { $CustomInspect } from '@/src/lib/constants.js';

describe('unit.documents.datatypes.time', () => {
  describe('construction', () => {
    const assertTimeOk = (params: any, exp: unknown = params) => {
      const time = params instanceof DataAPITime ? params : new DataAPITime(...params as [any]);
      assert.deepStrictEqual([time.hours, time.minutes, time.seconds, time.nanoseconds], exp);
    };

    const assertTimeNotOk = (params: any, err: any = Error) => {
      assert.throws(() => new DataAPITime(...params as [any]), err);
    };

    const notOkStrings = {
                       '11': [Error,      [ 11, NaN,   0,         0]],
               '2000-11-11': [Error,      [ 20,   0,   1, 100000000]],
                 '24:00:00': [RangeError, [ 24,   0,   0,         0]],
                 '00:60:00': [RangeError, [  0,  60,   0,         0]],
                 '00:00:60': [RangeError, [  0,   0,  60,         0]],
      '00:00:00.0000000000': [Error,      [  0,   0,   0,         0]],
                  '1:22:33': [Error,      [  1,   2,   3,         0]],
                 '-1:22:33': [Error,      [ -1,  22,  33,         0]],
          '12:34:56Z+05:30': [Error,      [ 12,  34,  56,      5000]],
              'i like cars': [Error,      [NaN, NaN, NaN,       NaN]],
    };

    const okStrings = {
      '11:11:11.111111111': [11, 11, 11, 111111111],
      '11:22:22.100000000': [11, 22, 22, 100000000],
              '11:33:33.1': [11, 33, 33, 100000000],
               '00:00:00.': [ 0,  0,  0,         0],
                '01:00:01': [ 1,  0,  1,         0],
                '01:01:00': [ 1,  1,  0,         0],
                   '10:10': [10, 10,  0,         0],
    };

    it('should parse a strict DataAPIDate from a valid string', () => {
      for (const [str, [err]] of Object.entries(notOkStrings)) {
        assertTimeNotOk([str], err);
      }
      for (const [str, ymd] of Object.entries(okStrings)) {
        assertTimeOk([str], ymd);
      }
    });

    it('should parse an unvalidated DataAPIDate from a string', () => {
      for (const [str, [, time]] of Object.entries(notOkStrings)) {
        assertTimeOk([str, false], time);
      }
      for (const [str, time] of Object.entries(okStrings)) {
        assertTimeOk([str, false], time);
      }
    });

    it('should convert a Date to a DataAPITime', () => {
      assertTimeOk([new Date('2000-01-31T12:59:59')], [12, 59, 59, 0]);
      assertTimeOk([new Date('2000-01-01T00:00:00')], [ 0,  0,  0, 0]);
    });

    it('should create a DataAPITime from hour+month+secs?+ns?', () => {
      assertTimeNotOk([.2,  1,  1,          1], TypeError);
      assertTimeNotOk([20, .1,  1,          1], TypeError);
      assertTimeNotOk([20,  1, .1,          1], TypeError);
      assertTimeNotOk([20,  1,  1,         .1], TypeError);
      assertTimeNotOk([-2,  1,  1,          1], RangeError);
      assertTimeNotOk([20, -1,  1,          1], RangeError);
      assertTimeNotOk([20,  1, -1,          1], RangeError);
      assertTimeNotOk([20,  1,  1,         -1], RangeError);
      assertTimeNotOk([20,  1,  1, 1000000000], RangeError);

      assertTimeOk([12, 34        ], [12, 34,  0,  0]);
      assertTimeOk([12, 34, 56    ], [12, 34, 56,  0]);
      assertTimeOk([12, 34, 56, 78], [12, 34, 56, 78]);
    });

    it('should get the current date', () => {
      assert.ok(time.now());
    });

    it('should get the current utc date', () => {
      assert.ok(time.utcnow());
    });

    it('should reject invalid args', () => {
      assertTimeNotOk([2000], TypeError);
      assertTimeNotOk([2000, 1, 2n, 3], TypeError);
      assertTimeNotOk([], RangeError);
      assertTimeNotOk([1, 2, 3, 4, 5], RangeError);
      assertTimeNotOk([new Date('i like cars')], Error);
    });

    it('should get date from ofSecondOfDay', () => {
      assert.throws(() => time.ofSecondOfDay(1000n as any), TypeError);
      assert.throws(() => time.ofSecondOfDay(123.456),      TypeError);
      assert.throws(() => time.ofSecondOfDay(-1),           RangeError);
      assert.throws(() => time.ofSecondOfDay(86_400),       RangeError);

      assertTimeOk(time.ofSecondOfDay(     0), [ 0,  0,  0, 0]);
      assertTimeOk(time.ofSecondOfDay(     1), [ 0,  0,  1, 0]);
      assertTimeOk(time.ofSecondOfDay(    60), [ 0,  1,  0, 0]);
      assertTimeOk(time.ofSecondOfDay(    61), [ 0,  1,  1, 0]);
      assertTimeOk(time.ofSecondOfDay(86_399), [23, 59, 59, 0]);
    });

    it('should get date from ofNanoOfDay', () => {
      assert.throws(() => time.ofNanoOfDay(1000n as any),       TypeError);
      assert.throws(() => time.ofNanoOfDay(123.456),            TypeError);
      assert.throws(() => time.ofNanoOfDay(-1),                 RangeError);
      assert.throws(() => time.ofNanoOfDay(86_400_000_000_000), RangeError);

      assertTimeOk(time.ofNanoOfDay(0),                  [ 0,  0,  0,           0]);
      assertTimeOk(time.ofNanoOfDay(1),                  [ 0,  0,  0,           1]);
      assertTimeOk(time.ofNanoOfDay(1_000_000_000),      [ 0,  0,  1,           0]);
      assertTimeOk(time.ofNanoOfDay(1_000_000_001),      [ 0,  0,  1,           1]);
      assertTimeOk(time.ofNanoOfDay(86_399_999_999_999), [23, 59, 59, 999_999_999]);
    });
  });

  describe('comparison', () => {
    it('should work', () => {
      assert.strictEqual(time('12:00:00.01').compare(time('12:00:00.01')), 0);

      assert.strictEqual(time('12:00:00.00').compare(time('12:00:00.01')), -1);
      assert.strictEqual(time('12:00:00.59').compare(time('12:00:01.00')), -1);
      assert.strictEqual(time('12:00:59.59').compare(time('12:01:00.00')), -1);
      assert.strictEqual(time('12:59:59.59').compare(time('13:00:00.00')), -1);

      assert.strictEqual(time('12:00:00.01').compare(time('12:00:00.00')), 1);
      assert.strictEqual(time('12:00:01.00').compare(time('12:00:00.59')), 1);
      assert.strictEqual(time('12:01:00.00').compare(time('12:00:59.59')), 1);
      assert.strictEqual(time('13:00:00.00').compare(time('12:59:59.59')), 1);
    });
  });

  describe('equality', () => {
    assert.strictEqual(time('12:00:00').equals(time('12:00:00')), true);
    assert.strictEqual(time('12:00:00.0123').equals(time('12:00:00.0123')), true);
    assert.strictEqual(time('12:00:00').equals(time('12:00:00.000000001')), false);
    assert.strictEqual(time('12:00:00').equals(time('12:00:01')), false);
    assert.strictEqual(time('12:00:00').equals('12:00:00' as any), false);
  });

  describe('toDate', () => {
    it('should work without a base', () => {
      const date = new Date(`${new Date().toLocaleDateString('sv')}T12:34:56`);
      assert.ok(Math.abs(time('12:34:56').toDate().getTime() - date.getTime()) < 10);
    });

    it('should work with a base Date', () => {
      assert.deepStrictEqual(time('12:34:56').toDate(new Date('2000-01-01T00:00:00')), new Date('2000-01-01T12:34:56'));
      assert.deepStrictEqual(time('12:34:56').toDate(new Date('2000-01-01T00:00:00')), new Date('2000-01-01T12:34:56'));
    });

    it('should work with a base DataAPITime', () => {
      assert.deepStrictEqual(time('12:34:56').toDate(date(2000, 1, 1)), new Date('2000-01-01T12:34:56'));
    });
  });

  describe('toDateUTC', () => {
    it('should work without a base', () => {
      const date = new Date(`${new Date().toLocaleDateString('sv', { timeZone: 'utc' })}T12:34:56Z`);
      assert.ok(Math.abs(time('12:34:56').toDateUTC().getTime() - date.getTime()) < 10);
    });

    it('should work with a base Date', () => {
      assert.deepStrictEqual(time('12:34:56').toDateUTC(new Date('2000-01-01:')), new Date(`${new Date('2000-01-01:').toLocaleDateString('sv', { timeZone: 'utc' })}T12:34:56Z`));
      assert.deepStrictEqual(time('12:34:56').toDateUTC(new Date('2000-01-01:Z')), new Date('2000-01-01T12:34:56Z'));
    });

    it('should work with a base DataAPITime', () => {
      assert.deepStrictEqual(time('12:34:56').toDateUTC(date(2000, 1, 1)), new Date('2000-01-01T12:34:56Z'));
    });
  });

  describe('toString', () => {
    it('should work', () => {
      assert.strictEqual(time('12:34:56.789').toString(), '12:34:56.789000000');
      assert.strictEqual(time('12:34:56').toString(), '12:34:56.000000000');
    });
  });

  describe('inspect', () => {
    it('should work', () => {
      assert.strictEqual((time('12:34:56.789') as any)[$CustomInspect](), 'DataAPITime("12:34:56.789000000")');
    });
  });
});
