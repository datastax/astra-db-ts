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
import { DataAPITime, time } from '@/src/documents';
import { describe, it } from '@/tests/testlib';

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
                 'asdfdsaf': [Error,      [NaN, NaN, NaN,         0]],
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
      assertTimeNotOk([.002,  1,  1,  1], TypeError);
      assertTimeNotOk([2000, .1,  1,  1], TypeError);
      assertTimeNotOk([2000,  1, .1,  1], TypeError);
      assertTimeNotOk([2000,  1,  1, .1], TypeError);
      assertTimeNotOk([-200,  1,  1,  1], RangeError);
      assertTimeNotOk([2000, -1,  1,  1], RangeError);
      assertTimeNotOk([2000,  1, -1,  1], RangeError);
      assertTimeNotOk([2000,  1,  1, -1], RangeError);

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
  });
});
