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
import { DataAPIDate, date } from '@/src/documents';
import { describe, it } from '@/tests/testlib';

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
  });
});
