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
import { DataAPIDate, date, time } from '@/src/documents';
import { describe, it } from '@/tests/testlib';
import { $CustomInspect } from '@/src/lib/constants';

describe('unit.documents.datatypes.date', () => {
  describe('construction', () => {
    const assertDateOk = (params: any, ymd: unknown = params) => {
      const date = params instanceof DataAPIDate ? params : new DataAPIDate(...params as [any]);
      assert.deepStrictEqual([date.year, date.month, date.date], ymd);
    };

    const assertDateNotOk = (params: any, err: any = Error) => {
      assert.throws(() => new DataAPIDate(...params as [any]), err);
    };

    const notOkStrings = {
      '-0000-01-01': [RangeError, [  -0,  1,   1]],
       '2000-00-01': [RangeError, [2000,  0,   1]],
       '2000-01-00': [RangeError, [2000,  1,   0]],
       '2000/01/01': [Error,      [ NaN,  0, NaN]],
       '2000-01-32': [RangeError, [2000,  1,  32]],
       '2000-02-30': [RangeError, [2000,  2,  30]],
       '1999-02-29': [RangeError, [1999,  2,  29]],
       '-200-01-01': [Error,      [ -200, 1,   1]],
        '200-01-01': [Error,      [  200, 1,   1]],
        '2000-1-01': [Error,      [ 2000, 1,   1]],
        '2000-01-1': [Error,      [ 2000, 1,   1]],
          '2000-01': [Error,      [ 2000, 1, NaN]],
    };

    const okStrings = {
      '-20000-01-01': [-20000, 1,  1],
      '+20000-01-01': [ 20000, 1,  1],
       '20000-01-01': [ 20000, 1,  1],
       '+2000-01-01': [  2000, 1,  1],
        '2000-01-01': [  2000, 1,  1],
        '2000-01-31': [  2000, 1, 31],
        '2000-02-29': [  2000, 2, 29],
        '2004-02-29': [  2004, 2, 29],
    };

    it('should parse a strict DataAPIDate from a valid string', () => {
      for (const [str, [err]] of Object.entries(notOkStrings)) {
        assertDateNotOk([str], err);
      }
      for (const [str, ymd] of Object.entries(okStrings)) {
        assertDateOk([str], ymd);
      }
    });

    it('should parse an unvalidated DataAPIDate from a string', () => {
      for (const [str, [, ymd]] of Object.entries(notOkStrings)) {
        assertDateOk([str, false], ymd);
      }
      for (const [str, ymd] of Object.entries(okStrings)) {
        assertDateOk([str, false], ymd);
      }
    });

    it('should convert a Date to a DataAPIDate', () => {
      assertDateOk([new Date(200000, 11, 1)],          [200000, 12,  1]);
      assertDateOk([new Date(-20000, 0,  9)],          [-20000,  1,  9]);
      assertDateOk([new Date('2000-01-31T12:59:59Z')], [  2000,  1, 31]);
      assertDateOk([new Date('2000-01-01T00:00:00Z')], [  2000,  1,  1]);
    });

    it('should create a DataAPIDate from year+month+day', () => {
      assertDateNotOk([2000, .1,  1], TypeError);
      assertDateNotOk([2000,  1, .1], TypeError);
      assertDateNotOk([.002,  1,  1], TypeError);
      assertDateNotOk([2000,  0,  1], RangeError);
      assertDateNotOk([2000, 13,  1], RangeError);
      assertDateNotOk([-200,  2, 29], RangeError);
      assertDateNotOk([1900,  2, 29], RangeError);
      assertDateNotOk([2001,  2, 29], RangeError);
      assertDateNotOk([2001,  2,  0], RangeError);

      assertDateOk([-204,  2, 29]);
      assertDateOk([2000,  1,  1]);
      assertDateOk([2000,  2, 29]);
      assertDateOk([2004,  2, 29]);
    });

    it('should get the current date', () => {
      assertDateOk(date.now(), [new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()]);
    });

    it('should get the current utc date', () => {
      assertDateOk(date.utcnow(), [new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, new Date().getUTCDate()]);
    });

    it('should reject invalid args', () => {
      assertDateNotOk([2000], TypeError);
      assertDateNotOk([2000, 1, 2n], TypeError);
    });

    it('should get date from ofEpochDay', () => {
      assert.throws(() => date.ofEpochDay(0n as any),    TypeError);
      assert.throws(() => date.ofEpochDay(123.456),      TypeError);
      assert.throws(() => date.ofEpochDay(100_000_001),  RangeError);
      assert.throws(() => date.ofEpochDay(-100_000_001), RangeError);

      assertDateOk(date.ofEpochDay(           0), [  1970,  1,  1]);
      assertDateOk(date.ofEpochDay(           1), [  1970,  1,  2]);
      assertDateOk(date.ofEpochDay(          -1), [  1969, 12, 31]);
      assertDateOk(date.ofEpochDay( 100_000_000), [ 275760, 9, 13]);
      assertDateOk(date.ofEpochDay(-100_000_000), [-271821, 4, 20]);
    });

    it('should get date from ofYearDay', () => {
      assert.throws(() => date.ofYearDay(0n as any,    0), TypeError);
      assert.throws(() => date.ofYearDay(      123, 45.6), TypeError);
      assert.throws(() => date.ofYearDay(     2000,    0), RangeError);
      assert.throws(() => date.ofYearDay(     2001,  366), RangeError);
      assert.throws(() => date.ofYearDay(     1900,  366), RangeError);
      assert.throws(() => date.ofYearDay(   275760,  258), RangeError);
      assert.throws(() => date.ofYearDay(  -271821,  109), RangeError);

      assertDateOk(date.ofYearDay(   2000,   1), [   2000,  1,  1]);
      assertDateOk(date.ofYearDay(   2000, 366), [   2000, 12, 31]);
      assertDateOk(date.ofYearDay(   2004, 366), [   2004, 12, 31]);
      assertDateOk(date.ofYearDay( 275760, 257), [ 275760,  9, 13]);
      assertDateOk(date.ofYearDay(-271821, 110), [-271821,  4, 20]);
    });
  });

  describe('comparison', () => {
    it('should work', () => {
      assert.strictEqual(date(2000, 1, 1).compare(date(2000, 1, 1)), 0);

      assert.strictEqual(date(2000, 1, 1).compare(date(2000, 1, 2)), -1);
      assert.strictEqual(date(2000, 1, 9).compare(date(2000, 2, 1)), -1);
      assert.strictEqual(date(2000, 9, 9).compare(date(2001, 1, 1)), -1);

      assert.strictEqual(date(2000, 1, 2).compare(date(2000, 1, 1)), 1);
      assert.strictEqual(date(2000, 2, 1).compare(date(2000, 1, 9)), 1);
      assert.strictEqual(date(2001, 1, 1).compare(date(2000, 9, 9)), 1);
    });
  });

  describe('equality', () => {
    it('should work', () => {
      assert.strictEqual(date(2000, 1, 1).equals(date(2000, 1, 1)), true);
      assert.strictEqual(date(2000, 1, 1).equals(date(2000, 1, 2)), false);
      assert.strictEqual(date(2000, 1, 1).equals('2000-1-1' as any), false);
    });
  });

  describe('toDate', () => {
    it('should work without a base', () => {
      assert.deepStrictEqual(date(2000, 1, 1).toDate(), new Date('2000-01-01T00:00:00Z'));
    });

    it('should work with a base Date', () => {
      assert.deepStrictEqual(date(2000, 1, 1).toDate(new Date('1970-01-01T12:34:56Z')), new Date('2000-01-01T12:34:56Z'));
    });

    it('should work with a base DataAPITime', () => {
      assert.deepStrictEqual(date(2000, 1, 1).toDate(time('12:34:56')), new Date('2000-01-01T12:34:56'));
    });
  });

  describe('toDateUTC', () => {
    it('should work', () => {
      assert.deepStrictEqual(date(2000, 1, 1).toDateUTC(time('12:34:56')), new Date('2000-01-01T12:34:56Z'));
    });
  });

  describe('toString', () => {
    it('should work', () => {
      assert.strictEqual(date(9999, 1, 1).toString(), '9999-01-01');
      assert.strictEqual(date(10000, 12, 31).toString(), '+10000-12-31');
      assert.strictEqual(date(-1, 1, 1).toString(), '-0001-01-01');
    });
  });

  describe('inspect', () => {
    it('should work', () => {
      assert.strictEqual((date(10000, 12, 31) as any)[$CustomInspect](), 'DataAPIDate("+10000-12-31")');
    });
  });
});
