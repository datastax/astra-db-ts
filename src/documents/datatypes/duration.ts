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

import { $CustomInspect } from '@/src/lib/constants';
import { TableCodec, TableDesCtx, TableSerCtx } from '@/src/documents';
import { $DeserializeForTable, $SerializeForTable } from '@/src/documents/tables/ser-des/constants';
import { mkInvArgsErr } from '@/src/documents/utils';
import { Ref } from '@/src/lib/types';

const NS_PER_HOUR = 3_600_000_000_000n;
const NS_PER_MIN = 60_000_000_000n;
const NS_PER_SEC = 1_000_000_000n;
const NS_PER_MS = 1_000_000n;
const NS_PER_US = 1_000n;

/**
 * #### Overview
 *
 * Represents a `duration` column for Data API tables.
 *
 * Internally represented as a number of months, days, and nanoseconds (units which are not directly convertible to each other).
 *
 * #### Format
 *
 * The duration may be one of four different formats:
 *
 * ###### Standard duration format
 *
 * Matches `-?(<number><unit>)+`, where the unit is one of:
 * - `y` (years; 12 months)
 * - `mo` (months)
 * - `w` (weeks; 7 days)
 * - `d` (days)
 * - `h` (hours; 3,600,000,000,000 nanoseconds)
 * - `m` (minutes; 60,000,000,000 nanoseconds)
 * - `s` (seconds; 1,000,000,000 nanoseconds)
 * - `ms` (milliseconds; 1,000,000 nanoseconds)
 * - `us` or `µs` (microseconds; 1,000 nanoseconds)
 * - `ns` (nanoseconds)
 *
 * At least one of the above units must be present, and they must be in the order shown above.
 *
 * Units in this format are case-insensitive.
 *
 * @example
 * ```ts
 * duration('1y2mo3w4d5h6m7s8ms9us10ns');
 * duration('-2w');
 * duration('0s');
 * ```
 *
 * ###### ISO 8601 duration format
 *
 * Matches `-?P<date>[T<time>]?`, where `<date>` is `(<number><date_unit>)*` and `<time>` is `(<number><time_unit>)+`.
 *
 * `<date_unit>` is one of:
 * - `Y` (years)
 * - `M` (months)
 * - `D` (days)
 *
 * `<time_unit>` is one of:
 * - `H` (hours)
 * - `M` (minutes)
 * - `S` (seconds)
 *
 * The P delimiter is required, and the T delimiter is only required if `<time>` is present.
 *
 * At least one date or time component must be present, and units must be in the order shown above.
 *
 * Units are case-sensitive in this format.
 *
 * Milli/micro/nanoseconds may be provided as a fractional component of the seconds unit.
 *
 * @example
 * ```ts
 * duration('P1Y2M3DT4H5M6.007S');
 * duration('-P7D');
 * duration('PT0S');
 * ```
 *
 * ###### ISO 8601 week duration format
 *
 * Matches `-?P<weeks>W` exactly. No trailing T, or any other units, are allowed in this (case-sensitive) format.
 *
 * @example
 * ```ts
 * duration('P2W');
 * duration('-P2W');
 * ```
 *
 * ###### ISO 8601 alternate duration format
 *
 * Matches `-?P<YYYY>-<MM>-<DD>T<hh>:<mm>:<ss>` exactly.
 *
 * The date and time components must be in the order, length, and case shown, and the P & T delimiters are required.
 *
 * @example
 * ```ts
 * duration('-P0001-02-03T04:05:06');
 * ```
 *
 * #### Creation
 *
 * There are a few different ways to initialize a new `DataAPIDuration`:
 *
 * @example
 * ```ts
 * // Parse a duration given one of the above duration-string formats
 * new DataAPIDuration('1y2mo3w4d5h6m7s8ms9us10ns');
 * new DataAPIDuration('P1Y2M3DT4H5M6.007S');
 * new DataAPIDuration('-P2W');
 * new DataAPIDuration('P0001-02-03T04:05:06');
 *
 * // Create a `DataAPIDuration` from months, days, and nanoseconds
 * new DataAPIDuration(0, 10, 1000 * 60 * 60 * 24 * 3).negate();
 *
 * // Create a `DataAPIDuration` using the builder class
 * DataAPIDuration.builder()
 *   .addYears(1)
 *   .addDays(3)
 *   .addSeconds(5)
 *   .negate()
 *   .build();
 * ```
 *
 * #### The `duration` shorthand
 *
 * You may use the {@link duration} shorthand function-object anywhere when creating new `DataAPIDuration`s.
 *
 * @example
 * ```ts
 * // equiv. to `new DataAPIDuration('-2w')`
 * duration('-2w')
 *
 * // equiv. to `new DataAPIDuration(2, 1, 0)`
 * duration(12, 1, 0)
 *
 * // equiv. to `DataAPIDuration.builder().build()`
 * duration.builder().build()
 * ```
 *
 * See the official DataStax documentation for more information.
 *
 * @see duration
 * @see DataAPIDurationBuilder
 *
 * @public
 */
export class DataAPIDuration implements TableCodec<typeof DataAPIDuration> {
  /**
   * The months component of this `DataAPIDuration`.
   *
   * May be negative if and only if the other components are also negative.
   */
  readonly months: number;

  /**
   * The days component of this `DataAPIDuration`.
   *
   * May be negative if and only if the other components are also negative.
   */
  readonly days: number;

  /**
   * The nanoseconds component of this `DataAPIDuration`.
   *
   * May be negative if and only if the other components are also negative.
   */
  readonly nanoseconds: bigint;

  /**
   * Implementation of `$SerializeForTable` for {@link TableCodec}
   */
  public [$SerializeForTable](ctx: TableSerCtx) {
    return ctx.done(durationToShortString(this));
  };

  /**
   * Implementation of `$DeserializeForTable` for {@link TableCodec}
   */
  public static [$DeserializeForTable](_: unknown, value: any, ctx: TableDesCtx) {
    return ctx.done(new DataAPIDuration(value, true));
  }

  /**
   * ##### Overview
   *
   * Helpful utility for manually creating new `DataAPIDuration` instances.
   *
   * Contains builder methods for incrementally adding duration components, and negating the final result.
   *
   * ##### Usage
   *
   * You may call each `.add*()` method any number of times, in any order, before calling `build`.
   *
   * The `.negate(sign?)` method may be called at any time to negate the final result.
   * - You may pass a boolean to `.negate(sign?)` to definitively set the sign
   * - Otherwise, the sign will be toggled.
   *
   * A `base` duration may be provided to initialize the builder with its components and its sign.
   *
   * @example
   * ```ts
   * const base = duration('1y');
   *
   * // '-1y3d15h'
   * const span = duration.builder(base)
   *   .addHours(10)
   *   .addDays(3)
   *   .addHours(5)
   *   .negate()
   *   .build();
   * ```
   *
   * @param base - The base `DataAPIDuration` to initialize the builder with, if any
   *
   * @see DataAPIDurationBuilder
   */
  public static builder(base?: DataAPIDuration) {
    return new DataAPIDurationBuilder(base);
  }

  /**
   * ##### Overview
   *
   * Parses a `DataAPIDuration` from a string in one of the supported formats.
   *
   * See {@link DataAPIDuration} for more info about the supported formats.
   *
   * @example
   * ```ts
   * new DataAPIDuration('1y2mo3w4d5h6m7s8ms9us10ns');
   *
   * new DataAPIDuration('P1Y2M3DT4H5M6.007S');
   *
   * duration('-2w');
   *
   * duration('P0001-02-03T04:05:06');
   * ```
   *
   * @param duration - The duration to parse
   */
  constructor(duration: string);

  /**
   * Should not be called by user directly.
   *
   * @internal
   */
  constructor(duration: string, fromDataAPI: boolean);

  /**
   * ##### Overview
   *
   * Creates a `DataAPIDuration` from the given months, days, and nanoseconds.
   *
   * Either all parts must be positive, or all parts must be negative, to represent the duration's sign.
   *
   * The parts must be integers in the following ranges:
   * - `months` and `days` must be less than or equal to `2147483647` *(2^31 - 1)*
   * - `nanoseconds` must be less than or equal to `9223372036854775807` *(2^31 - 1)*
   *
   * @example
   * ```ts
   * new DataAPIDuration(2, 1, 0);
   *
   * duration(0, 10, 1000 * 60 * 60 * 24 * 3).negate();
   * ```
   *
   * @param months - The months component of the duration
   * @param days - The days component of the duration
   * @param nanoseconds - The nanoseconds component of the duration
   */
  constructor(months: number, days: number, nanoseconds: number | bigint);

  constructor(i1: string | number, i2?: number | boolean, i3?: number | bigint) {
    switch (arguments.length) {
      case 1:
      case 2:
        [this.months, this.days, this.nanoseconds] = parseDurationStr(i1, !!i2);
        break;
      case 3:
        if (typeof i1 !== 'number' || typeof i2 !== 'number' || (typeof i3 !== 'number' && typeof i3 !== 'bigint')) {
          throw mkInvArgsErr('new DataAPIDuration', [['months', 'number'], ['days', 'number'], ['nanoseconds', 'number | bigint']], i1, i2, i3);
        }
        validateDuration(i1, i2, BigInt(i3));
        [this.months, this.days, this.nanoseconds] = [i1, i2, BigInt(i3)];
        break;
      default: {
        throw RangeError(`Invalid number of arguments; expected 1..=3, got ${arguments.length}`);
      }
    }

    Object.defineProperty(this, $CustomInspect, {
      value: () => `DataAPIDuration("${this.toString()}")`,
    });
  }

  /**
   * ##### Overview
   *
   * Checks if this `DataAPIDuration` is equal to another `DataAPIDuration`.
   *
   * Two durations are only equal if all of their individuals components are equal to each other.
   *
   * @example
   * ```ts
   * duration('1y2d').equals(duration('P1Y2D')) // true
   *
   * duration('-7d').equals(duration('-P1W')) // true
   *
   * duration('1y').equals(duration('12mo')) // true
   *
   * duration('1y').equals(duration('365d')) // false
   * ```
   *
   * @param other - The other `DataAPIDuration` to compare to
   *
   * @returns `true` if the durations are exactly equal, or `false` otherwise
   */
  public equals(other: DataAPIDuration): boolean {
    return (other as unknown instanceof DataAPIDuration)
      && this.months === other.months
      && this.days === other.days
      && this.nanoseconds === other.nanoseconds;
  }

  /**
   * ##### Overview
   *
   * Checks if this `DataAPIDuration` has day precision—that is, if the nanoseconds component is zero.
   *
   * This means that no hours, minutes, seconds, milliseconds, microseconds, or nanoseconds are present.
   *
   * @returns `true` if this `DataAPIDuration` has day precision, or `false` otherwise
   */
  public hasDayPrecision(): boolean {
    return this.nanoseconds === 0n;
  }

  /**
   * ##### Overview
   *
   * Checks if this `DataAPIDuration` has millisecond precision—that is, if the nanoseconds component is a multiple of 1,000,000.
   *
   * This means that no microseconds or nanoseconds are present.
   *
   * If `true`, it entails that {@link DataAPIDuration.nanoseconds} & {@link DataAPIDuration.microseconds} may be safely cast to `number`.
   *
   * @returns `true` if this `DataAPIDuration` has millisecond precision, or `false` otherwise
   */
  public hasMillisecondPrecision(): boolean {
    return this.nanoseconds % NS_PER_MS === 0n;
  }

  /**
   * ##### Overview
   *
   * Checks if the sign of this `DataAPIDuration` is negative.
   *
   * @returns `true` if the sign of this `DataAPIDuration` is negative, or `false` otherwise
   */
  public isNegative(): boolean {
    return this.months < 0 || this.days < 0 || this.nanoseconds < 0n;
  }

  /**
   * ##### Overview
   *
   * Checks if this `DataAPIDuration` is zero—that is, if all components are zero.
   *
   * @returns `true` if this `DataAPIDuration` is zero, or `false` otherwise
   */
  public isZero(): boolean {
    return this.months === 0 && this.days === 0 && this.nanoseconds === 0n;
  }

  /**
   * ##### Overview
   *
   * Returns a new `DataAPIDuration` that is the sum of this `DataAPIDuration` and another `DataAPIDuration`.
   *
   * Each component of the other `DataAPIDuration` is added to the corresponding component of this `DataAPIDuration`.
   *
   * **However, if the signs of the two durations differ, `null` is returned.** A positive duration cannot be added to a negative duration, and vice versa.
   *
   * @example
   * ```ts
   * duration('1y').plus(duration('1y')) // '2y'
   *
   * duration('1y').plus(duration('1mo1s')) // '1y1mo1s'
   *
   * duration('1y').plus(duration('-1mo').abs()) // '1y1mo'
   *
   * duration('1y').plus(duration('-1mo')) // null
   * ```
   *
   * Note that this may lead to an error being thrown if any of the individual components exceed their maximum values.
   *
   * @param other - The other `DataAPIDuration` to add to this `DataAPIDuration`
   *
   * @returns A new `DataAPIDuration` that is the sum of this `DataAPIDuration` and the other `DataAPIDuration`, or `null` if the signs differ
   */
  public plus(other: DataAPIDuration): DataAPIDuration | null {
    if (this.isNegative() !== other.isNegative()) {
      return null;
    }

    return new DataAPIDuration(
      this.months + other.months,
      this.days + other.days,
      this.nanoseconds + other.nanoseconds,
    );
  }

  /**
   * ##### Overview
   *
   * Flips the sign of this `DataAPIDuration`.
   *
   * @example
   * ```ts
   * duration('1y').negate() // '-1y'
   *
   * duration('-1y').negate() // '1y'
   * ```
   *
   * @returns A new `DataAPIDuration` with the sign flipped
   */
  public negate(): DataAPIDuration {
    return new DataAPIDuration(-this.months, -this.days, -this.nanoseconds);
  }

  /**
   * ##### Overview
   *
   * Makes this `DataAPIDuration` unconditionally positive.
   *
   * @example
   * ```ts
   * duration('1y').abs() // '1y'
   *
   * duration('-1y').abs() // '1y'
   * ```
   *
   * @returns A new `DataAPIDuration` with the sign flipped
   */
  public abs(): DataAPIDuration {
    return this.isNegative() ? this.negate() : this;
  }

  /**
   * ##### Overview
   *
   * Returns the number of years in this `DataAPIDuration`, calculated solely from the `months` component.
   *
   * **Note: this does _not_ factor in the `days` or `nanoseconds` components.**
   *
   * Equivalent to `Math.floor(duration.months / 12)`.
   *
   * @example
   * ```ts
   * duration('1y15mo').toYears() // 2
   *
   * duration('-1y15mo').toYears() // -2
   *
   * duration('1y800d').toYears() // 1
   * ```
   *
   * @returns The number of years in this `DataAPIDuration` derived from the `months` component
   */
  public toYears(): number {
    return ~~(this.months / 12);
  }

  /**
   * ##### Overview
   *
   * Returns the number of hours in this `DataAPIDuration`, calculated solely from the `nanoseconds` component.
   *
   * **Note: this does _not_ factor in the `months` or `days` components.**
   *
   * Equivalent to `Number(duration.nanoseconds / 3_600_000_000_000)`.
   *
   * @example
   * ```ts
   * duration('10m').toHours() // 0
   *
   * duration('-50h150m').toHours() // -52
   *
   * duration('1y15mo1h').toHours() // 1
   *
   * duration('500d').toHours() // 0
   * ```
   *
   * @returns The number of hours in this `DataAPIDuration` derived from the `nanoseconds` component
   */
  public toHours(): number {
    return Number(this.nanoseconds / NS_PER_HOUR);
  }

  /**
   * ##### Overview
   *
   * Returns the number of minutes in this `DataAPIDuration`, calculated solely from the `nanoseconds` component.
   *
   * **Note: this does _not_ factor in the `months` or `days` components.**
   *
   * Equivalent to `Number(duration.nanoseconds / 60_000_000_000)`.
   *
   * @example
   * ```ts
   * duration('10ms').toMinutes() // 0
   *
   * duration('2y50h150m').toMinutes() // 3150
   *
   * duration('-1y15mo1h').toMinutes() // -60
   * ```
   *
   * @returns The number of minutes in this `DataAPIDuration` derived from the `nanoseconds` component
   */
  public toMinutes(): number {
    return Number(this.nanoseconds / NS_PER_MIN);
  }

  /**
   * ##### Overview
   *
   * Returns the number of seconds in this `DataAPIDuration`, calculated solely from the `nanoseconds` component.
   *
   * **Note: this does _not_ factor in the `months` or `days` components.**
   *
   * Equivalent to `Number(duration.nanoseconds / 1_000_000_000)`.
   *
   * @example
   * ```ts
   * duration('10ns').toSeconds() // 0
   *
   * duration('1y50h150m').toSeconds() // 189000
   *
   * duration('-1y15mo1h').toSeconds() // -3600
   * ```
   *
   * @returns The number of seconds in this `DataAPIDuration` derived from the `nanoseconds` component
   */
  public toSeconds(): number {
    return Number(this.nanoseconds / NS_PER_SEC);
  }

  /**
   * ##### Overview
   *
   * Returns the number of milliseconds in this `DataAPIDuration`, calculated solely from the `nanoseconds` component.
   *
   * **Note: this does _not_ factor in the `months` or `days` components.**
   *
   * Equivalent to `Number(duration.nanoseconds / 1_000_000)`.
   *
   * @example
   * ```ts
   * duration('10ns').toMillis() // 0
   *
   * duration('1y50h150m').toMillis() // 189000000
   *
   * duration('-1y15mo1h').toMillis() // -3600000
   * ```
   *
   * @returns The number of milliseconds in this `DataAPIDuration` derived from the `nanoseconds` component
   */
  public toMillis(): number {
    return Number(this.nanoseconds / NS_PER_MS);
  }

  /**
   * ##### Overview
   *
   * Returns the number of microseconds in this `DataAPIDuration`, calculated solely from the `nanoseconds` component.
   *
   * **Note: this does _not_ factor in the `months` or `days` components.**
   *
   * Equivalent to `Number(duration.nanoseconds / 1_000)`.
   *
   * @example
   * ```ts
   * duration('1y50us').toMicros() // 50n
   *
   * duration('1y50ns').toMicros() // 0n
   *
   * duration('1h50ns').toMicros() // 3600000000n
   * ```
   *
   * @returns The number of microseconds in this `DataAPIDuration` derived from the `nanoseconds` component
   */
  public toMicros(): bigint {
    return this.nanoseconds / NS_PER_US;
  }

  /**
   * ##### Overview
   *
   * Returns the human-friendly string representation of this `DataAPIDuration`
   *
   * @example
   * ```ts
   * duration('15mo').toString() // '1y3mo'
   *
   * duration('-5ms10000us').toString() // '-15ms'
   * ```
   *
   * @returns The string representation of this `DataAPIDuration`
   */
  public toString(): string {
    return durationToLongString(this);
  }
}

/**
 * ##### Overview
 *
 * A shorthand function-object for {@link DataAPIDuration}. May be used anywhere when creating new `DataAPIDuration`s.
 *
 * See {@link DataAPIDuration} and its methods for information about input parameters, formats, functions, etc.
 *
 * @example
 * ```ts
 * // equiv. to `new DataAPIDuration('-2w')`
 * duration('-2w')
 *
 * // equiv. to `new DataAPIDuration(2, 1, 0)`
 * duration(12, 1, 0)
 *
 * // equiv. to `DataAPIDuration.builder().build()`
 * duration.builder().build()
 * ```
 *
 * @see DataAPIDuration
 *
 * @public
 */
export const duration = Object.assign(
  (duration: string) => new DataAPIDuration(duration),
  { builder: DataAPIDuration.builder },
);

/**
 * ##### Overview
 *
 * A helpful builder class for manually creating new `DataAPIDuration` instances.
 *
 * Provides methods for incrementally adding duration components, and negating the final result.
 *
 * Should be instantiated using {@link DataAPIDuration.builder}/{@link duration.builder}.
 *
 * ##### Usage
 *
 * You may call each `.add*()` method any number of times, in any order, before calling `build`.
 *
 * The `.negate(sign?)` method may be called at any time to negate the final result.
 * - You may pass a boolean to `.negate(sign?)` to definitively set the sign
 * - Otherwise, the sign will be toggled.
 *
 * A `base` duration may be provided to initialize the builder with its components and its sign.
 *
 * @example
 * ```ts
 * const base = duration('1y');
 *
 * // '-1y3d15h'
 * const span = duration.builder(base)
 *  .addHours(10)
 *  .addDays(3)
 *  .addHours(5)
 *  .negate()
 *  .build();
 * ```
 *
 * @see DataAPIDuration
 *
 * @public
 */
export class DataAPIDurationBuilder {
  private _months = 0;
  private _days = 0;
  private _nanoseconds = 0n;
  private _index = -1;
  private _negative = false;

  /**
   * Should not be called by user directly.
   *
   * @internal
   */
  constructor(base?: DataAPIDuration, private readonly validateOrder = false) {
    if (base) {
      this._months = Math.abs(base.months);
      this._days = Math.abs(base.days);
      this._nanoseconds = base.nanoseconds < 0n ? -base.nanoseconds : base.nanoseconds;
      this._negative = base.isNegative();
    }
  }

  /**
   * ##### Overview
   *
   * Negates the final result of this `DataAPIDurationBuilder`.
   *
   * A boolean parameter may be provided to force the sign to be negative/positive—otherwise, it defaults to toggling the sign.
   *
   * **Note that negation does not take place until the `.build()` method is called.** It simply marks the final result as to-be-negated or not.
   *
   * @example
   * ```ts
   * // '-10h'
   * const span = duration.builder()
   *  .addHours(10)
   *  .negate()
   *  .build();
   *
   * // '10h'
   * const span = duration.builder()
   *  .addHours(10)
   *  .negate(true)
   *  .negate(false)
   *  .build();
   * ```
   *
   * @param negative - Whether to set the sign to negative; defaults to the opposite of the current sign
   *
   * @returns The mutated builder instance
   */
  public negate(negative: boolean = !this._negative): this {
    this._negative = negative;
    return this;
  }

  /**
   * ##### Overview
   *
   * Adds the given number of years to this `DataAPIDurationBuilder`.
   *
   * Years are converted to months before being added (1 year = 12 months).
   *
   * If the total number of months exceeds `2147483647` *(2^31 - 1)*, a `RangeError` is thrown.
   *
   * The years may be negative to perform a subtraction operation, but if the total number of months becomes negative, a `RangeError` also is thrown. To negate the final result, use the `.negate()` method.
   *
   * @example
   * ```ts
   * // '2y'
   * const span = duration.builder()
   *  .addYears(1)
   *  .addYears(1)
   *  .build();
   *
   * // true
   * duration('24mo').equals(span)
   * ```
   *
   * @param years - The number of years to add
   */
  public addYears(years: number): this {
    this._validateIndex(0);
    this._validateMonths(years, 12, 'years');
    this._months += years * 12;
    return this;
  }

  /**
   * ##### Overview
   *
   * Adds the given number of months to this `DataAPIDurationBuilder`.
   *
   * If the total number of months exceeds `2147483647` *(2^31 - 1)*, a `RangeError` is thrown.
   *
   * The months may be negative to perform a subtraction operation, but if the total number of months becomes negative, a `RangeError` also is thrown. To negate the final result, use the `.negate()` method.
   *
   * @example
   * ```ts
   * // '24mo'
   * const span = duration.builder()
   *  .addMonths(24)
   *  .build();
   *
   * // true
   * duration('2y').equals(span)
   * ```
   *
   * @param months - The number of months to add
   *
   * @returns The mutated builder instance
   */
  public addMonths(months: number): this {
    this._validateIndex(1);
    this._validateMonths(months, 1, 'months');
    this._months += months;
    return this;
  }

  /**
   * ##### Overview
   *
   * Adds the given number of weeks to this `DataAPIDurationBuilder`.
   *
   * Weeks are converted to days before being added (1 week = 7 days).
   *
   * If the total number of days exceeds `2147483647` *(2^31 - 1)*, a `RangeError` is thrown.
   *
   * The weeks may be negative to perform a subtraction operation, but if the total number of days becomes negative, a `RangeError` also is thrown. To negate the final result, use the `.negate()` method.
   *
   * @example
   * ```ts
   * // '2w'
   * const span = duration.builder()
   *  .addWeeks(2)
   *  .build();
   *
   * // true
   * duration('14d').equals(span)
   * ```
   *
   * @param weeks - The number of weeks to add
   *
   * @returns The mutated builder instance
   */
  public addWeeks(weeks: number): this {
    this._validateIndex(2);
    this._validateDays(weeks, 7, 'weeks');
    this._days += weeks * 7;
    return this;
  }

  /**
   * ##### Overview
   *
   * Adds the given number of days to this `DataAPIDurationBuilder`.
   *
   * If the total number of days exceeds `2147483647` *(2^31 - 1)*, a `RangeError` is thrown.
   *
   * The days may be negative to perform a subtraction operation, but if the total number of days becomes negative, a `RangeError` also is thrown. To negate the final result, use the `.negate()` method.
   *
   * @example
   * ```ts
   * // '14d'
   * const span = duration.builder()
   *  .addDays(14)
   *  .build();
   *
   * // true
   * duration('2w').equals(span)
   * ```
   *
   * @param days - The number of days to add
   *
   * @returns The mutated builder instance
   */
  public addDays(days: number): this {
    this._validateIndex(3);
    this._validateDays(days, 1, 'days');
    this._days += days;
    return this;
  }

  /**
   * ##### Overview
   *
   * Adds the given number of hours to this `DataAPIDurationBuilder`.
   *
   * Hours are converted to nanoseconds before being added (1 hour = 3,600,000,000,000 nanoseconds).
   *
   * If the total number of nanoseconds exceeds `9223372036854775807n` *(2^63 - 1)*, a `RangeError` is thrown.
   *
   * The hours may be negative to perform a subtraction operation, but if the total number of nanoseconds becomes negative, a `RangeError` also is thrown. To negate the final result, use the `.negate()` method.
   *
   * @example
   * ```ts
   * // '10h'
   * const span = duration.builder()
   *  .addHours(10)
   *  .build();
   *
   * // true
   * duration('600m').equals(span)
   * ```
   *
   * @param hours - The number of hours to add
   *
   * @returns The mutated builder instance
   */
  public addHours(hours: number | bigint): this {
    this._validateIndex(4);
    const big = this._validateNanos(hours, NS_PER_HOUR, 'hours');
    this._nanoseconds += big * NS_PER_HOUR;
    return this;
  }

  /**
   * ##### Overview
   *
   * Adds the given number of minutes to this `DataAPIDurationBuilder`.
   *
   * Minutes are converted to nanoseconds before being added (1 minute = 60,000,000,000 nanoseconds).
   *
   * If the total number of nanoseconds exceeds `9223372036854775807n` *(2^63 - 1)*, a `RangeError` is thrown.
   *
   * The minutes may be negative to perform a subtraction operation, but if the total number of nanoseconds becomes negative, a `RangeError` also is thrown. To negate the final result, use the `.negate()` method.
   *
   * @example
   * ```ts
   * // '10m'
   * const span = duration.builder()
   *  .addMinutes(10)
   *  .build();
   *
   * // true
   * duration('600s').equals(span)
   * ```
   *
   * @param minutes - The number of minutes to add
   *
   * @returns The mutated builder instance
   */
  public addMinutes(minutes: number | bigint): this {
    this._validateIndex(5);
    const big = this._validateNanos(minutes, NS_PER_MIN, 'minutes');
    this._nanoseconds += big * NS_PER_MIN;
    return this;
  }

  /**
   * ##### Overview
   *
   * Adds the given number of seconds to this `DataAPIDurationBuilder`.
   *
   * Seconds are converted to nanoseconds before being added (1 second = 1,000,000,000 nanoseconds).
   *
   * If the total number of nanoseconds exceeds `9223372036854775807n` *(2^63 - 1)*, a `RangeError` is thrown.
   *
   * The seconds may be negative to perform a subtraction operation, but if the total number of nanoseconds becomes negative, a `RangeError` also is thrown. To negate the final result, use the `.negate()` method.
   *
   * @example
   * ```ts
   * // '10s'
   * const span = duration.builder()
   *  .addSeconds(10)
   *  .build();
   *
   * // true
   * duration('10000ms').equals(span)
   * ```
   *
   * @param seconds - The number of seconds to add
   *
   * @returns The mutated builder instance
   */
  public addSeconds(seconds: number | bigint): this {
    this._validateIndex(6);
    const big = this._validateNanos(seconds, NS_PER_SEC, 'seconds');
    this._nanoseconds += big * NS_PER_SEC;
    return this;
  }

  /**
   * ##### Overview
   *
   * Adds the given number of milliseconds to this `DataAPIDurationBuilder`.
   *
   * Milliseconds are converted to nanoseconds before being added (1 millisecond = 1,000,000 nanoseconds).
   *
   * If the total number of nanoseconds exceeds `9223372036854775807n` *(2^63 - 1)*, a `RangeError` is thrown.
   *
   * The milliseconds may be negative to perform a subtraction operation, but if the total number of nanoseconds becomes negative, a `RangeError` also is thrown. To negate the final result, use the `.negate()` method.
   *
   * @example
   * ```ts
   * // '1000ms'
   * const span = duration.builder()
   *  .addMillis(1000)
   *  .build();
   *
   * // true
   * duration('1s').equals(span)
   * ```
   *
   * @param milliseconds - The number of milliseconds to add
   *
   * @returns The mutated builder instance
   */
  public addMillis(milliseconds: number | bigint): this {
    this._validateIndex(7);
    const big = this._validateNanos(milliseconds, NS_PER_MS, 'milliseconds');
    this._nanoseconds += big * NS_PER_MS;
    return this;
  }

  /**
   * ##### Overview
   *
   * Adds the given number of microseconds to this `DataAPIDurationBuilder`.
   *
   * Microseconds are converted to nanoseconds before being added (1 microsecond = 1,000 nanoseconds).
   *
   * If the total number of nanoseconds exceeds `9223372036854775807n` *(2^63 - 1)*, a `RangeError` is thrown.
   *
   * The microseconds may be negative to perform a subtraction operation, but if the total number of nanoseconds becomes negative, a `RangeError` also is thrown. To negate the final result, use the `.negate()` method.
   *
   * @example
   * ```ts
   * // '1000us'
   * const span = duration.builder()
   *  .addMicros(1000)
   *  .build();
   *
   * // true
   * duration('1ms').equals(span)
   * ```
   *
   * @returns The mutated builder instance
   *
   * @param microseconds - The number of microseconds to add
   */
  public addMicros(microseconds: number | bigint): this {
    this._validateIndex(8);
    const big = this._validateNanos(microseconds, NS_PER_US, 'microseconds');
    this._nanoseconds += big * NS_PER_US;
    return this;
  }

  /**
   * ##### Overview
   *
   * Adds the given number of nanoseconds to this `DataAPIDurationBuilder`.
   *
   * If the total number of nanoseconds exceeds `9223372036854775807n` *(2^63 - 1)*, a `RangeError` is thrown.
   *
   * The nanoseconds may be negative to perform a subtraction operation, but if the total number of nanoseconds becomes negative, a `RangeError` also is thrown. To negate the final result, use the `.negate()` method.
   *
   * @example
   * ```ts
   * // '1000ns'
   * const span = duration.builder()
   *  .addNanos(1000)
   *  .build();
   *
   * // true
   * duration('1us').equals(span)
   * ```
   *
   * @param nanoseconds - The number of nanoseconds to add
   *
   * @returns The mutated builder instance
   */
  public addNanos(nanoseconds: number | bigint): this {
    this._validateIndex(9);
    const big = this._validateNanos(nanoseconds, 1n, 'nanoseconds');
    this._nanoseconds += big;
    return this;
  }

  /**
   * ##### Overview
   *
   * Builds a new `DataAPIDuration` instance from the components added to this `DataAPIDurationBuilder`.
   *
   * May be called at any time to retrieve the current state of the builder as a `DataAPIDuration`.
   *
   * @example
   * ```ts
   * const builder = duration
   *   .builder()
   *   .addYears(1);
   *
   * // '1y'
   * const span1 = builder.build().toString();
   *
   * builder
   *   .negate()
   *   .addMonths(1);
   *
   * // '-1y1mo'
   * const span2 = builder.build().toString();
   * ```
   *
   * @returns A new `DataAPIDuration` instance derived from this `DataAPIDurationBuilder`
   */
  public build(): DataAPIDuration {
    return (this._negative)
      ? new DataAPIDuration(-this._months, -this._days, -this._nanoseconds)
      : new DataAPIDuration(this._months, this._days, this._nanoseconds);
  }

  /**
   * ##### Overview
   *
   * Clones this `DataAPIDurationBuilder` instance.
   *
   * The cloned instance will have the same components as this one, but will be a separate object.
   *
   * ```ts
   * const builder = duration.builder().addYears(1);
   * const clone = builder.clone();
   * builder.addMonths(1);
   *
   * // '1y'
   * clone.build().toString();
   *
   * // '1y1mo'
   * builder.build().toString();
   * ```
   *
   * @returns A new `DataAPIDurationBuilder` instance with the same components as this one
   */
  public clone(): DataAPIDurationBuilder {
    const clone = new DataAPIDurationBuilder(undefined, this.validateOrder);
    clone._months = this._months;
    clone._days = this._days;
    clone._nanoseconds = this._nanoseconds;
    clone._index = this._index;
    clone._negative = this._negative;
    return clone;
  }

  /**
   * @internal
   */
  public raw(): MDN {
    return (this._negative)
      ? [-this._months, -this._days, -this._nanoseconds]
      : [this._months, this._days, this._nanoseconds];
  }

  private _validateMonths(units: number, monthsPerUnit: number, unit: string) {
    if (!Number.isInteger(units)) {
      throw new TypeError(`Invalid duration; ${unit} must be an integer; got: ${units}`);
    }

    const exceedsMax = units > (2147483647 - this._months) / monthsPerUnit;
    const becomesNegative = units < 0 && units < -this._months / monthsPerUnit;

    if (exceedsMax || becomesNegative) {
      const actualValue = BigInt(this._months) + BigInt(units) * BigInt(monthsPerUnit);
      throw new RangeError(`Invalid duration. The total number of months must be in range [0, 2147483647]; got: ${actualValue} (tried to add ${units} ${unit})`);
    }
  }

  private _validateDays(units: number, daysPerUnit: number, unit: string) {
    if (!Number.isInteger(units)) {
      throw new TypeError(`Invalid duration; ${unit} must be an integer; got: ${units}`);
    }

    const exceedsMax = units > (2147483647 - this._days) / daysPerUnit;
    const becomesNegative = units < 0 && units < -this._days / daysPerUnit;

    if (exceedsMax || becomesNegative) {
      const actualValue = BigInt(this._days) + BigInt(units) * BigInt(daysPerUnit);
      throw new RangeError(`Invalid duration. The total number of days must be in range [0, 2147483647]; got: ${actualValue} (tried to add ${units} ${unit})`);
    }
  }

  private _validateNanos(units: bigint | number, nanosPerUnit: bigint, unit: string): bigint {
    if (typeof units !== 'bigint' && !Number.isInteger(units)) {
      throw new TypeError(`Invalid duration; ${unit} must be an integer/bigint; got: ${units}`);
    }

    const big = BigInt(units);

    const exceedsMax = big > (9223372036854775807n - this._nanoseconds) / nanosPerUnit;
    const becomesNegative = big < 0n && big < -this._nanoseconds / nanosPerUnit;

    if (exceedsMax || becomesNegative) {
      const actualValue = this._nanoseconds + big * nanosPerUnit;
      throw new RangeError(`Invalid duration. The total number of nanoseconds must be in range [0, 9223372036854775807]; got: ${actualValue} (tried to add ${units} ${unit})`);
    }

    return big;
  }

  private _validateIndex(index: number) {
    if (!this.validateOrder) {
      return;
    }

    if (this._index === index) {
      throw new SyntaxError(`Invalid duration; ${BuilderAddNamesLUT[index]} may not be set multiple times`);
    }

    if (this._index > index) {
      throw new SyntaxError(`Invalid duration; ${BuilderAddNamesLUT[index]} must be set before ${BuilderAddNamesLUT[this._index]}`);
    }

    this._index = index;
  }
}

type MDN = [number, number, bigint];

const BuilderAddNamesLUT = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds', 'milliseconds', 'microseconds', 'nanoseconds'];

const parseDurationStr = (str: unknown, fromDataAPI: boolean): MDN => {
  if (typeof str !== 'string') {
    throw mkInvArgsErr('DataAPIDate.parse', [['duration', 'string']], str);
  }

  const isNegative = str[0] === '-';
  const durationStr = isNegative ? str.slice(1) : str;

  if (!durationStr) {
    throw new SyntaxError('Invalid duration; empty string (or just a sign) is not allowed. To pass a zero-duration, use something like 0s, PT0S, or some other zero-unit.');
  }

  if (fromDataAPI) {
    return parseDataAPIDuration(durationStr, isNegative);
  }

  const builder = new DataAPIDurationBuilder(undefined, true).negate(isNegative);

  if (durationStr[0] === 'P') {
    if (durationStr.at(-1) === 'W') {
      return parseISOWeekDuration(durationStr, builder);
    }
    if (durationStr.includes('-')) {
      return parseISOAlternateDuration(durationStr, builder);
    }
    return parseISOStandardDuration(durationStr, builder);
  }

  return parseBasicDuration(durationStr, builder);
};

type DurationMethodsLUT = Record<string, (d: MDN, n: number) => void>;

const DataAPIDurationMethodsLUT1: DurationMethodsLUT = {
  'Y': (d, ys) => d[0] += ys * 12,
  'M': (d, ms) => d[0] += ms,
  'D': (d, ds) => d[1] += ds,
};

const DataAPIDurationMethodsLUT2: DurationMethodsLUT = {
  'H': (d, hs) => d[2] += BigInt(hs) * NS_PER_HOUR,
  'M': (d, ms) => d[2] += BigInt(ms) * NS_PER_MIN,
  '.': (d, s) => d[2] += BigInt(s) * NS_PER_SEC,
  'S': (d, s) => d[2] += BigInt(s) * NS_PER_SEC,
};

const parseDataAPIDuration = (str: string, negative: boolean): MDN => {
  const duration: MDN = [0, 0, 0n];

  let lut = DataAPIDurationMethodsLUT1;
  let index = 1;

  while (index < str.length) {
    if (str[index] === 'T') {
      lut = DataAPIDurationMethodsLUT2;
      index++;
    }

    const num = parseInt(str.slice(index), 10);
    index += num === 0 ? 1 : Math.floor(Math.log10(num)) + 1;

    const unit = str[index++];
    lut[unit](duration, num);

    if (unit === '.') {
      return parseDataAPIDurationNanos(str.slice(index), duration);
    }
  }

  if (negative) {
    duration[0] = -duration[0];
    duration[1] = -duration[1];
    duration[2] = -duration[2];
  }

  return duration;
};

const parseDataAPIDurationNanos = (str: string, duration: MDN): MDN => {
  duration[2] += BigInt(parseInt(str, 10) * Math.pow(10, 10 - str.length));
  return duration;
};

const BasicDurationRegex = /(\d+)(y|mo|w|d|h|s|ms|us|µs|ns|m)/gyi;

const parseBasicDuration = (str: string, builder: DataAPIDurationBuilder): MDN => {
  let match: RegExpExecArray | null;
  BasicDurationRegex.lastIndex = 0;

  while ((match = BasicDurationRegex.exec(str))) {
    const num = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit.toLowerCase()) {
      case 'y': builder.addYears(num); break;
      case 'mo': builder.addMonths(num); break;
      case 'w': builder.addWeeks(num); break;
      case 'd': builder.addDays(num); break;
      case 'h': builder.addHours(num); break;
      case 'm': builder.addMinutes(num); break;
      case 's': builder.addSeconds(num); break;
      case 'ms': builder.addMillis(num); break;
      case 'us': case 'µs': builder.addMicros(num); break;
      case 'ns': builder.addNanos(num); break;
    }

    if (BasicDurationRegex.lastIndex === str.length) {
      return builder.raw();
    }
  }

  throw mkSyntaxErr('standard', str);
};

const ISOStandardDurationRegex = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.(\d+))?S)?)?$/;

const parseISOStandardDuration = (str: string, builder: DataAPIDurationBuilder): MDN => {
  const match = str.match(ISOStandardDurationRegex);

  if (!match) {
    throw mkSyntaxErr('ISO-8601 standard', str);
  }

  if (match[1]) builder.addYears(parseInt(match[1], 10));
  if (match[2]) builder.addMonths(parseInt(match[2], 10));
  if (match[3]) builder.addDays(parseInt(match[3], 10));
  if (match[4]) builder.addHours(parseInt(match[4], 10));
  if (match[5]) builder.addMinutes(parseInt(match[5], 10));
  if (match[6]) builder.addSeconds(parseInt(match[6], 10));
  if (match[7]) builder.addNanos(parseInt(match[7], 10) * Math.pow(10, 9 - match[7].length));

  return builder.raw();
};

const ISOWeekDurationRegex = /^P(\d+)W$/;

const parseISOWeekDuration = (str: string, builder: DataAPIDurationBuilder): MDN => {
  const match = str.match(ISOWeekDurationRegex);

  if (!match) {
    throw mkSyntaxErr('ISO-8601 week', str);
  }

  return builder
    .addWeeks(parseInt(match[1], 10))
    .raw();
};

const ISOAlternateDurationRegex = /^P(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

const parseISOAlternateDuration = (str: string, builder: DataAPIDurationBuilder): MDN => {
  const match = str.match(ISOAlternateDurationRegex);

  if (!match) {
    throw mkSyntaxErr('ISO-8601 alternate', str);
  }

  return builder
    .addYears(parseInt(match[1], 10))
    .addMonths(parseInt(match[2], 10))
    .addDays(parseInt(match[3], 10))
    .addHours(parseInt(match[4], 10))
    .addMinutes(parseInt(match[5], 10))
    .addSeconds(parseInt(match[6], 10))
    .raw();
};

const validateDuration = (months: number, days: number, nanoseconds: bigint): void => {
  const allPositive = months >= 0 && days >= 0 && nanoseconds >= 0n;
  const allNegative = months <= 0 && days <= 0 && nanoseconds <= 0n;

  if (!(allPositive || allNegative)) {
    throw new RangeError(`Invalid duration (${months}, ${days}, ${nanoseconds}); all parts (months, days, nanoseconds) must have the same sign`);
  }

  if (!Number.isInteger(months) || !Number.isInteger(days)) {
    throw new TypeError(`Invalid duration (${months}, ${days}, ${nanoseconds}); all parts (months, days, nanoseconds) must be integer`);
  }

  if (months > 2147483647 || days > 2147483647 || nanoseconds > 9223372036854775807n) {
    throw new RangeError(`Invalid duration (${months}, ${days}, ${nanoseconds}); months and days must be in range [-2147483647, 2147483647], nanoseconds must be in range [-9223372036854775807, 9223372036854775807]`);
  }
};

const durationToShortString = (duration: DataAPIDuration): string => {
  let res = duration.isNegative() ? '-' : '';

  if (duration.months) {
    res += duration.months + 'mo';
  }

  if (duration.days) {
    res += duration.days + 'd';
  }

  if (duration.nanoseconds) {
    res += duration.nanoseconds + 'ns';
  }

  return res || '0s';
};

const durationToLongString = (duration: DataAPIDuration): string => {
  const res = { ref: duration.isNegative() ? '-' : '' };

  if (duration.months) {
    let remainingMonths = Math.abs(duration.months);
    remainingMonths = appendNumberUnit(res, remainingMonths, 12, 'y');
    appendNumberUnit(res, remainingMonths, 1, 'mo');
  }

  if (duration.days) {
    appendNumberUnit(res, Math.abs(duration.days), 1, 'd');
  }

  if (duration.nanoseconds) {
    let remainingNanos = duration.nanoseconds < 0 ? -duration.nanoseconds : duration.nanoseconds;
    remainingNanos = appendBigIntUnit(res, remainingNanos, NS_PER_HOUR, 'h');
    remainingNanos = appendBigIntUnit(res, remainingNanos, NS_PER_MIN, 'm');
    remainingNanos = appendBigIntUnit(res, remainingNanos, NS_PER_SEC, 's');
    remainingNanos = appendBigIntUnit(res, remainingNanos, NS_PER_MS, 'ms');
    remainingNanos = appendBigIntUnit(res, remainingNanos, NS_PER_US, 'us');
    appendBigIntUnit(res, remainingNanos, 1n, 'ns');
  }

  return res.ref || '0s';
};

const appendNumberUnit = (result: Ref<string>, value: number, unitSize: number, unitLabel: string): number => {
  if (value >= unitSize) {
    result.ref += Math.floor(value / unitSize) + unitLabel;
    return value % unitSize;
  }
  return value;
};

const appendBigIntUnit = (result: Ref<string>, value: bigint, unitSize: bigint, unitLabel: string): bigint => {
  if (value >= unitSize) {
    result.ref += (value / unitSize).toString() + unitLabel;
    return value % unitSize;
  }
  return value;
};

const mkSyntaxErr = (fmtAttempted: string, str: string) => {
  return new SyntaxError(`Invalid duration string: '${str}'. Attempted to parse as ${fmtAttempted} duration format, but failed. Please provide a valid duration string (see DataAPIDuration documentation for format info).`);
};
