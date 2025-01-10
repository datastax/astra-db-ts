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
import { DataAPIDuration, duration } from '@/src/documents';
import { describe, it } from '@/tests/testlib';

describe('unit.documents.datatypes.duration', () => {
  describe('construction', () => {
    const assertDurationOk = (params: any, ymd: unknown = params[0]) => {
      const date = params instanceof DataAPIDuration ? params : new DataAPIDuration(...params as [any]);
      assert.deepStrictEqual(date.toString(), ymd);
    };

    const assertDurationNotOk = (params: any, err: any = Error) => {
      assert.throws(() => new DataAPIDuration(...params as [any]), err);
    };

    it('should parse a DataAPIDuration from std format', () => {
      assertDurationNotOk(['1s9ns10us'], SyntaxError);
      assertDurationNotOk(['1s9ns10ns'], SyntaxError);
      assertDurationNotOk(['1y2mo3wX'], SyntaxError);
      assertDurationNotOk(['1y2moX3w'], SyntaxError);
      assertDurationNotOk(['.1y2mo3w'], SyntaxError);
      assertDurationNotOk(['100000000h'], RangeError);
      assertDurationNotOk(['P1y2mo'], SyntaxError);
      assertDurationNotOk(['+1y2d'], SyntaxError);
      assertDurationNotOk([''], SyntaxError);

      assertDurationOk(['1y2mo3w4d5h6m7s8ms9us10ns'], '1y2mo25d5h6m7s8ms9us10ns');
      assertDurationOk(['1Y2Mo3W4D5H6M7S8mS9µS10NS'], '1y2mo25d5h6m7s8ms9us10ns');
      assertDurationOk(['003µs'], '3us');
      assertDurationOk(['-4d2s0ms'], '-4d2s');
      assertDurationOk(['0y0mo000000w0d0h0m0000s0ms00us00ns'], '0s');
      assertDurationOk(['1m60s'], '2m');
    });

    it('should parse a DataAPIDuration from std ISO format', () => {
      assertDurationNotOk(['P1Y1m'], SyntaxError);
      assertDurationNotOk(['P1S'], SyntaxError);
      assertDurationNotOk(['T1S'], SyntaxError);
      assertDurationNotOk(['P1Y1Y'], SyntaxError);
      assertDurationNotOk(['P1YX'], SyntaxError);
      assertDurationNotOk(['P1M1Y'], SyntaxError);
      assertDurationNotOk(['P1W1D'], SyntaxError);
      assertDurationNotOk(['P1Y1M-'], SyntaxError);
      assertDurationNotOk(['P1000000000Y'], RangeError);

      assertDurationOk(['P1Y2M3DT4H5M6.123456789S'], '1y2mo3d4h5m6s123ms456us789ns');
      assertDurationOk(['P001Y'], '1y');
      assertDurationOk(['P1YT'], '1y');
      assertDurationOk(['PT1S'], '1s');
      assertDurationOk(['-P1YT1.01S'], '-1y1s10ms');
      assertDurationOk(['-PT1H1M1.00001S'], '-1h1m1s10us');
      assertDurationOk(['-P3MT3.00000001S'], '-3mo3s10ns');
      assertDurationOk(['P00Y000M0DT00H0M000.00S'], '0s');
      assertDurationOk(['-P'], '0s');
      assertDurationOk(['PT'], '0s');
    });

    it('should parse a DataAPIDuration from week ISO format', () => {
      assertDurationNotOk(['P1WT'], SyntaxError);
      assertDurationNotOk(['P1WT1S'], SyntaxError);
      assertDurationNotOk(['P1W1D'], SyntaxError);
      assertDurationNotOk(['P1000000000W'], RangeError);

      assertDurationOk(['P5W'], '35d');
      assertDurationOk(['-P005W'], '-35d');
      assertDurationOk(['P0W'], '0s');
    });

    it('should parse a DataAPIDuration from alternative ISO format', () => {
      assertDurationNotOk(['P1111-22-33'], SyntaxError);
      assertDurationNotOk(['P1111-22-33T'], SyntaxError);
      assertDurationNotOk(['P1111-22-33T44:55:66.777'], SyntaxError);
      assertDurationNotOk(['P11-22-33T44:55:66'], SyntaxError);
      assertDurationNotOk(['P1111-33T44:55:66'], SyntaxError);
      assertDurationNotOk(['P1111-22-33T44:66'], SyntaxError);
      assertDurationNotOk(['PT44:55:66'], SyntaxError);
      assertDurationNotOk(['P-1111-22-33T44:55:66'], SyntaxError);

      assertDurationOk(['P1111-11-11T11:11:11'], '1111y11mo11d11h11m11s');
      assertDurationOk(['P0000-00-00T00:00:00'], '0s');
      assertDurationOk(['-P0001-00-03T04:00:06'], '-1y3d4h6s');
      assertDurationOk(['P9999-12-31T23:59:59'], '10000y31d23h59m59s');
    });

    it('should construct a DataAPIDuration from the three components', () => {
      assertDurationNotOk([-1, 0, 1], RangeError);
      assertDurationNotOk([2 ** 31, 0, 0], RangeError);
      assertDurationNotOk([2 ** 31, 2 ** 31, 0], RangeError);
      assertDurationNotOk([0, 0, 2n ** 63n], RangeError);
      assertDurationNotOk([1, 0, -1], RangeError);
      assertDurationNotOk([.1, 1, 1], TypeError);
      assertDurationNotOk([1n, 1, 1], TypeError);

      assertDurationOk([0, 0, 0], '0s');
      assertDurationOk([0, 0, -1], '-1ns');
      assertDurationOk([0, 0, -1n], '-1ns');
      assertDurationOk([1, 60, 0], '1mo60d');
      assertDurationOk([2 ** 31 - 1, 2 ** 31 - 1, 2n ** 63n - 1n], '178956970y7mo2147483647d2562047h47m16s854ms775us807ns');
      assertDurationOk([-(2 ** 31 - 1), -(2 ** 31 - 1), -(2n ** 63n - 1n)], '-178956970y7mo2147483647d2562047h47m16s854ms775us807ns');
    });
  });

  describe('builder', () => {
    it('should build a DataAPIDuration', () => {
      const span1 = duration.builder()
        .addDays(1)
        .addWeeks(1)
        .addYears(1)
        .addMonths(1)
        .addHours(1)
        .addMinutes(1)
        .addSeconds(1)
        .addMillis(1)
        .addMicros(1)
        .addNanos(1)
        .negate()
        .build();
      assert.strictEqual(span1.toString(), '-1y1mo8d1h1m1s1ms1us1ns');

      const span2 = duration.builder()
        .addHours(1)
        .negate()
        .addHours(1)
        .negate()
        .addMonths(14)
        .addYears(1)
        .build();
      assert.strictEqual(span2.toString(), '2y2mo2h');
    });

    it('should build a DataAPIDuration based on another duration', () => {
      const orig = duration('-1y1mo1d');

      const span = duration.builder(orig)
        .addMonths(12)
        .addYears(1)
        .addSeconds(1)
        .build();
      assert.strictEqual(span.toString(), '-3y1mo1d1s');
    });

    it('should clone a builder', () => {
      const builder = duration.builder()
        .negate()
        .addHours(1);

      const clone = builder.clone();

      builder
        .negate()
        .addHours(1);

      assert.strictEqual(builder.build().toString(), '2h');
      assert.strictEqual(clone.build().toString(), '-1h');
    });

    it('should negate properly', () => {
      const neg1 = duration.builder()
        .addHours(1)
        .negate(true)
        .build();
      assert.strictEqual(neg1.toString(), '-1h');

      const pos = duration.builder()
        .addHours(1)
        .negate(false)
        .build();
      assert.strictEqual(pos.toString(), '1h');

      const neg2 = duration.builder()
        .addHours(1)
        .negate(false)
        .negate()
        .build();
      assert.strictEqual(neg2.toString(), '-1h');
    });

    const methods = <const>{
      'addYears': ~~(2 ** 31 / 12) + 1,
      'addMonths': 2 ** 31,
      'addWeeks': ~~(2 ** 31 / 7) + 1,
      'addDays': 2 ** 31,
      'addHours': 2n ** 63n / 3_600_000_000_000n + 1n,
      'addMinutes': 2n ** 63n / 60_000_000_000n + 1n,
      'addSeconds': 2n ** 63n / 1_000_000_000n + 1n,
      'addMillis': 2n ** 63n / 1_000_000n + 1n,
      'addMicros': 2n ** 63n / 1_000n + 1n,
      'addNanos': 2n ** 63n,
    };

    it('should deal with overflows properly', () => {
      for (const [method, value] of Object.entries(methods)) {
        assert.throws(() => (duration.builder() as any)[method](value), RangeError);
        assert.ok((duration.builder() as any)[method](typeof value === 'bigint' ? value - 1n : value -1).build());
      }
    });

    it('should deal with underflows properly', () => {
      for (const method of Object.keys(methods)) {
        assert.ok((duration.builder() as any)[method](1)[method](-1).build());
        assert.throws(() => (duration.builder() as any)[method](-1), RangeError);
      }
    });
  });

  describe('utility methods', () => {
    it('should have working hasDayPrecision()', () => {
      assert.ok(duration('2w').hasDayPrecision());
      assert.ok(duration('0s').hasDayPrecision());
      assert.ok(duration('-1y2w1d').hasDayPrecision());
      assert.ok(!duration('1ns').hasDayPrecision());
      assert.ok(!duration('60h').hasDayPrecision());
    });

    it('should have working hasMillisecondPrecision()', () => {
      assert.ok(duration('1ms').hasMillisecondPrecision());
      assert.ok(duration('0s').hasMillisecondPrecision());
      assert.ok(duration('-1y2w1d1ms').hasMillisecondPrecision());
      assert.ok(duration('1ms').hasMillisecondPrecision());
      assert.ok(duration('1000µs').hasMillisecondPrecision());
      assert.ok(!duration('999µs').hasMillisecondPrecision());
      assert.ok(!duration('1ns').hasMillisecondPrecision());
    });

    it('should have working isNegative()', () => {
      assert.ok(duration('-1ns').isNegative());
      assert.ok(!duration('-0ns').isNegative());
      assert.ok(!duration('0ns').isNegative());
      assert.ok(!duration('1ns').isNegative());
    });

    it('should have working isZero()', () => {
      assert.ok(duration('0s').isZero());
      assert.ok(duration('-0s').isZero());
      assert.ok(!duration('1ns').isZero());
      assert.ok(!duration('-1y').isZero());
    });

    it('should have working plus()', () => {
      assert.strictEqual(duration('1y').plus(duration('-1y')), null);
      assert.strictEqual(duration('-1y').plus(duration('1y')), null);
      assert.strictEqual(duration('0s').plus(duration('-0s'))?.toString(), '0s');
      assert.strictEqual(duration('1y3mo15d').plus(duration('9mo30d1ns'))?.toString(), '2y45d1ns');
      assert.strictEqual(duration('-1y3mo15d').plus(duration('-9mo30d1ns'))?.toString(), '-2y45d1ns');
    });

    it('should have working negate()', () => {
      assert.strictEqual(duration('0s').negate().toString(), '0s');
      assert.strictEqual(duration('1y11mo1ns').negate().toString(), '-1y11mo1ns');
      assert.strictEqual(duration('-1y11mo1ns').negate().toString(), '1y11mo1ns');
      assert.ok(duration('1ns').negate().isNegative());
      assert.ok(!duration('-1ns').negate().isNegative());
    });

    it('should have 6-pack abs()', () => {
      assert.ok(!duration('1y1mo1d1h1m1s').abs().isNegative());
      assert.ok(!duration('-1y1mo1d1h1m1s').abs().isNegative());
      assert.ok(!duration('1y').abs().isNegative());
      assert.ok(!duration('-1y').abs().isNegative());
      assert.ok(!duration('0s').abs().isNegative());
      assert.ok(!duration('-0s').abs().isNegative());
    });

    it('should have working toYears()', () => {
      assert.strictEqual(duration('50000d1ns').toYears(), 0);
      assert.strictEqual(duration('1y50000d').toYears(), 1);
      assert.strictEqual(duration('-1y500d').toYears(), -1);
      assert.strictEqual(duration('1y25mo').toYears(), 3);
      assert.strictEqual(duration('-25mo').toYears(), -2);
    });

    it('should have working months', () => {
      assert.strictEqual(duration('50000d1ns').months, 0);
      assert.strictEqual(duration('1y50000d').months, 12);
      assert.strictEqual(duration('-1y500d').months, -12);
      assert.strictEqual(duration('1y25mo').months, 37);
      assert.strictEqual(duration('-25mo').months, -25);
    });

    it('should have working days', () => {
      assert.strictEqual(duration('10000000m').days, 0);
      assert.strictEqual(duration('1y50000d').days, 50000);
      assert.strictEqual(duration('-1y500d').days, -500);
      assert.strictEqual(duration('1y25mo').days, 0);
      assert.strictEqual(duration('-25mo').days, -0);
    });

    it('should have working toHours()', () => {
      assert.strictEqual(duration('1y1d').toHours(), 0);
      assert.strictEqual(duration('-1d1h200m').toHours(), -4);
      assert.strictEqual(duration('1d1h1m3600s').toHours(), 2);
    });

    it('should have working toMinutes()', () => {
      assert.strictEqual(duration('1y1d').toMinutes(), 0);
      assert.strictEqual(duration('-1d1h200m').toMinutes(), -260);
      assert.strictEqual(duration('1d1h1m3600s').toMinutes(), 121);
    });

    it('should have working toSeconds()', () => {
      assert.strictEqual(duration('1y1d').toSeconds(), 0);
      assert.strictEqual(duration('-1d1h200m1ms').toSeconds(), -15600);
      assert.strictEqual(duration('1d1h1m3601s').toSeconds(), 7261);
    });

    it('should have working toMillis()', () => {
      assert.strictEqual(duration('1y1d').toMillis(), 0);
      assert.strictEqual(duration('-1d1h200m1ms1001us').toMillis(), -15600002);
      assert.strictEqual(duration('1d1h1m3601s3ns').toMillis(), 7261000);
    });

    it('should have working toMicros()', () => {
      assert.strictEqual(duration('1y1d').toMicros(), 0n);
      assert.strictEqual(duration('-1d1ms1001us1001ns').toMicros(), -2002n);
      assert.strictEqual(duration('1d1000s3ns').toMicros(), 1000000000n);
    });

    it('should have working nanoseconds', () => {
      assert.strictEqual(duration('1y1d').nanoseconds, 0n);
      assert.strictEqual(duration('-1d1001us1001ns').nanoseconds, -1002001n);
      assert.strictEqual(duration('1d1000s3ns').nanoseconds, 1000000000003n);
    });
  });
});
