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

import { $CustomInspect } from '@/src/lib/constants.js';
import type { DataAPIDate, TableCodec, TableDesCtx, TableSerCtx } from '@/src/documents/index.js';
import { $DeserializeForTable, $SerializeForTable } from '@/src/documents/tables/ser-des/constants.js';
import { mkInvArgsErr } from '@/src/documents/utils.js';

/**
 * ##### Overview
 *
 * Represents a `time` column for Data API tables.
 *
 * ##### Format
 *
 * `time`s consist of an hour, a minute, and optional second and nanosecond components.
 *
 * - The hour is a number from 0 to 23, and must be positive.
 * - The minute is a number from 0 to 59.
 * - The second is a number from 0 to 59, and will default to 0 if not provided.
 * - The nanosecond is a fractional component of the second, and will default to 0 if not provided.
 *   - It is a number up to 9 digits long.
 *   - If any digits are omitted, they are assumed to be 0.
 *   - e.g. `12:34:56.789` is equivalent to `12:34:56.789000000`.
 *   - Seconds must be provided if nanoseconds are provided.
 *
 * Together, the format would be as such: `HH:MM[:SS[.NNNNNNNNN]]`.
 *
 * ##### Creation
 *
 * There are a number of different ways to initialize a `DataAPITime`:
 *
 * @example
 * ```ts
 * // Convert a native JS `Date` to a `DataAPITime` (extracting only the local time)
 * new DataAPITIme(new Date('2004-09-14T12:00:00.000')) // '12:00:00.000000000'
 *
 * // Parse a time given the above time-string format
 * new DataAPITime('12:34:56.78') // '12:34:56.780000000'
 *
 * // Create a `DataAPIDate` from an hour, a minute, and optional second and nanosecond components
 * new DataAPITime(12, 34, 56, 78) // '12:34:56.000000078'
 *
 * // Get the current time (using the local timezone)
 * DataAPITime.now()
 *
 * // Get the current time (using UTC)
 * DataAPITime.utcnow()
 *
 * // Create a `DataAPITime` from the number of nanoseconds since the start of the day
 * DataAPITime.ofNanoOfDay(12_345_678_912_345) // '03:25:45.678912345'
 *
 * // Create a `DataAPITime` from the number of seconds since the start of the day
 * DataAPITime.ofSecondOfDay(12_345) // '03:25:45.000000000'
 * ```
 *
 * ##### The `time` shorthand
 *
 * You may use the {@link time} shorthand function-object anywhere when creating new `DataAPITime`s.
 *
 * @example
 * ```ts
 * // equiv. to `new DataAPITime('12:34:56')`
 * time('12:34:56')
 *
 * // equiv. to `new DataAPITime(12, 34, 56)`
 * time(12, 34, 56)
 *
 * // equiv. to `DataAPITime.now()`
 * time.now()
 * ```
 *
 * See the official DataStax documentation for more information.
 *
 * @see time
 *
 * @public
 */
export class DataAPITime implements TableCodec<typeof DataAPITime> {
  /**
   * The hour component of this `DataAPITime`.
   *
   * Must be between 0-23.
   */
  readonly hours: number;

  /**
   * The minute component of this `DataAPITime`.
   *
   * Must be between 0-59.
   */
  readonly minutes: number;

  /**
   * The second component of this `DataAPITime`.
   *
   * Must be between 0-59.
   */
  readonly seconds: number;

  /**
   * The nanosecond component of this `DataAPITime`.
   *
   * Must be between 0-999,999,999.
   */
  readonly nanoseconds: number;

  /**
   * Implementation of `$SerializeForTable` for {@link TableCodec}
   */
  public [$SerializeForTable](ctx: TableSerCtx) {
    return ctx.done(this.toString());
  };

  /**
   * Implementation of `$DeserializeForTable` for {@link TableCodec}
   */
  public static [$DeserializeForTable](value: any, ctx: TableDesCtx) {
    return ctx.done(new DataAPITime(value));
  }

  /**
   * ##### Overview
   *
   * Returns the current time in the local timezone.
   *
   * Equivalent to `new DataAPITime(new Date())`.
   *
   * @example
   * ```ts
   * const now = time.now();
   * // or
   * const now = DataAPITime.now()
   * ```
   *
   * @returns The current time in the local timezone
   */
  public static now(this: void): DataAPITime {
    return new DataAPITime(new Date());
  }

  /**
   * ##### Overview
   *
   * Returns the current time in UTC.
   *
   * Uses `Date.now()` under the hood.
   *
   * @example
   * ```ts
   * const now = time.utcnow();
   * // or
   * const now = DataAPITime.utcnow()
   * ```
   *
   * @returns The current time in UTC
   */
  public static utcnow(this: void): DataAPITime {
    return new DataAPITime(...ofNanoOfDay((Date.now() % 86_400_000) * 1_000_000));
  }

  /**
   * ##### Overview
   *
   * Creates a `DataAPITime` from the number of nanoseconds since the start of the day .
   *
   * The number must be a positive integer in the range [0, 86,399,999,999,999].
   *
   * @example
   * ```ts
   * DataAPITime.ofNanoOfDay(0) // '00:00:00.000000000'
   *
   * date.ofNanoOfDay(12_345_678_912_345) // '03:25:45.678912345'
   * ```
   *
   * @param nanoOfDay - The number of nanoseconds since the start of the day
   *
   * @returns The `DataAPITime` representing the given number of nanoseconds
   */
  public static ofNanoOfDay(this: void, nanoOfDay: number): DataAPITime {
    return new DataAPITime(...ofNanoOfDay(nanoOfDay));
  }

  /**
   * ##### Overview
   *
   * Creates a `DataAPITime` from the number of seconds since the start of the day.
   *
   * The number must be a positive integer in the range [0, 86,399].
   *
   * @example
   * ```ts
   * DataAPITime.ofSecondOfDay(0) // '00:00:00.000000000'
   *
   * DataAPITime.ofSecondOfDay(12_345) // '03:25:45.000000000'
   * ```
   *
   * @param secondOfDay - The number of seconds since the start of the day
   *
   * @returns The `DataAPITime` representing the given number of seconds
   */
  public static ofSecondOfDay(this: void, secondOfDay: number): DataAPITime {
    return new DataAPITime(...ofSecondOfDay(secondOfDay));
  }

  /**
   * ##### Overview
   *
   * Converts a native JS `Date` to a `DataAPITime` (extracting only the local time).
   *
   * @example
   * ```ts
   * new DataAPITime(new Date('2004-09-14T12:00:00.000')) // '12:00:00.000000000'
   *
   * time(new Date('12:34:56.78')) // '12:34:56.780000000'
   * ```
   *
   * @param time - The `Date` object to convert
   */
  public constructor(time: Date);

  /**
   * ##### Overview
   *
   * Parses a `DataAPITime` from a string in the format `HH:MM[:SS[.NNNNNNNNN]]`.
   *
   * See {@link DataAPITime} for more info about the exact format.
   *
   * @example
   * ```ts
   * new DataAPITime('12:00') // '12:00:00.000000000'
   *
   * time('12:34:56.78') // '12:34:56.780000000'
   * ```
   *
   * @param time - The time string to parse
   */
  public constructor(time: string);

  /**
   * Should not be called by user directly.
   *
   * @internal
   */
  public constructor(time: string, strict: boolean);

  /**
   * ##### Overview
   *
   * Creates a `DataAPITime` from an hour, a minute, and optional second and nanosecond components.
   *
   * All components must be zero-indexed positive integers within the following ranges:
   * - `hour`: [0, 23]
   * - `minute`: [0, 59]
   * - `second`: [0, 59]
   * - `nanosecond`: [0, 999,999,999]
   *
   * @example
   * ```ts
   * new DataAPIDate(20, 15) // '20:15:00.000000000'
   *
   * date(12, 12, 12, 12) // '12:12:12.000000012'
   * ```
   *
   * @param hours - The hour to use
   * @param minutes - The minute to use
   * @param seconds - The second to use (defaults to 0)
   * @param nanoseconds - The nanosecond to use (defaults to 0)
   */
  public constructor(hours: number, minutes: number, seconds?: number, nanoseconds?: number);

  public constructor(i1: Date | string | number, i2?: boolean | number, i3?: number, i4?: number) {
    switch (arguments.length) {
      case 1: {
        if (typeof i1 === 'string') {
          [this.hours, this.minutes, this.seconds, this.nanoseconds] = parseTimeStr(i1, true);
        }
        else if (i1 instanceof Date) {
          if (isNaN(i1.getTime())) {
            throw new Error(`Invalid date '${i1.toString()}'; must be a valid (non-NaN) date`);
          }
          this.hours = i1.getHours();
          this.minutes = i1.getMinutes();
          this.seconds = i1.getSeconds();
          this.nanoseconds = i1.getMilliseconds() * 1_000_000;
        }
        else {
          throw mkInvArgsErr('new DataAPITime', [['time', 'string | Date']], i1);
        }
        break;
      }
      case 2: case 3: case 4: {
        if (typeof i1 === 'string') {
          [this.hours, this.minutes, this.seconds, this.nanoseconds] = parseTimeStr(i1, i2 !== false);
        }
        else if (typeof i1 === 'number' && typeof i2 === 'number' && (!i3 || typeof i3 as unknown === 'number') && (!i4 || typeof i4 as unknown === 'number')) {
          this.hours = i1;
          this.minutes = i2;
          this.seconds = i3 || 0;
          this.nanoseconds = i4 || 0;
          validateTime(this.hours, this.minutes, this.seconds, this.nanoseconds);
        }
        else {
          throw mkInvArgsErr('new DataAPIDate', [['hour', 'number'], ['minute', 'number'], ['second', 'number?'], ['nanosecond', 'number?']], i1, i2, i3, i4);
        }
        break;
      }
      default: {
        throw RangeError(`Invalid number of arguments; expected 1..=4, got ${arguments.length}`);
      }
    }

    Object.defineProperty(this, $CustomInspect, {
      value: () => `DataAPITime("${this.toString()}")`,
    });
  }

  /**
   * ##### Overview
   *
   * Converts this `DataAPITime` to a `Date` object in the local timezone.
   *
   * If no `base` date is provided, the time component defaults to the current local date.
   *
   * If the `base` parameter is a `DataAPIDate`, it is interpreted as being in the local timezone, not UTC.
   *
   * See {@link DataAPITime.toDateUTC} for a UTC-based alternative to this method.
   *
   * @example
   * ```ts
   * // Assuming the local timezone is UTC-6 (CST) //
   *
   * // Local Time: '2000-01-01T12:00:00'
   * // UTC Time:   '2000-01-01T18:00:00Z'
   * time('12:00:00').toDate(new Date('2000-01-01T00:00:00'));
   *
   * // Local Time: '1999-12-31T12:00:00'
   * // UTC Time:   '1999-12-31T18:00:00Z'
   * time('12:00:00').toDate(new Date('2000-01-01T00:00:00Z'));
   *
   * // Local Time: '2000-01-01T12:00:00'
   * // UTC Time:   '2000-01-01T18:00:00Z'
   * time('12:00:00').toDate(new DataAPIDate('2000-01-01'));
   *
   * // Local Time: '2025-01-22T12:00:00'
   * // UTC Time:   '2025-01-22T18:00:00Z'
   * time('12:00:00').toDate();
   * ```
   *
   * @param base - The base date to use for the date component. If omitted, defaults to the current local date.
   *
   * @returns The `Date` object representing this `DataAPITime` in the local timezone.
   *
   * @see DataAPITime.toDateUTC
   */
  public toDate(base?: Date | DataAPIDate): Date {
    base ||= new Date();

    if (base instanceof Date) {
      return new Date(base?.getFullYear() || 0, base?.getMonth() || 0, base?.getDate() || 0, this.hours, this.minutes, this.seconds, this.nanoseconds / 1_000_000);
    }

    return new Date(base.year, base.month - 1, base.date, this.hours, this.minutes, this.seconds, this.nanoseconds / 1_000_000);
  }

  /**
   * ##### Overview
   *
   * Converts this `DataAPITime` to a `Date` object in UTC.
   *
   * If no `base` date is provided, the time component defaults to the current date in UTC.
   *
   * If the `base` parameter is a `DataAPIDate`, it is interpreted as being in the UTC timezone.
   *
   * See {@link DataAPITime.toDate} for a local-date-based alternative to this method.
   *
   * @example
   * ```ts
   * // Assuming the local timezone is UTC-6 (CST) //
   *
   * // Local Time: '2000-01-01T06:00:00'
   * // UTC Time:   '2000-01-01T12:00:00Z'
   * time('12:00:00').toDateUTC(new Date('2000-01-01T00:00:00'));
   *
   * // Local Time: '2000-01-01T06:00:00Z'
   * // UTC Time:   '2000-01-01T12:00:00Z'
   * time('12:00:00').toDateUTC(new Date('2000-01-01T00:00:00Z'));
   *
   * // Local Time: '2000-01-01T06:00:00'
   * // UTC Time:   '2000-01-01T12:00:00Z'
   * time('12:00:00').toDateUTC(new DataAPIDate('2000-01-01'));
   *
   * // Local Time: '2025-01-22T06:00:00'
   * // UTC Time:   '2025-01-22T12:00:00Z'
   * time('12:00:00').toDateUTC();
   * ```
   *
   * @param base - The base date to use for the date component. If omitted, defaults to the current date in UTC.
   *
   * @returns The `Date` object representing this `DataAPITime` in UTC.
   *
   * @see DataAPITime.toDate
   */
  public toDateUTC(base?: Date | DataAPIDate): Date {
    base ||= new Date();

    if (base instanceof Date) {
      return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), this.hours, this.minutes, this.seconds, this.nanoseconds / 1_000_000));
    }

    return new Date(Date.UTC(base.year, base.month - 1, base.date, this.hours, this.minutes, this.seconds, this.nanoseconds / 1_000_000));
  }

  /**
   * ##### Overview
   *
   * Returns the string representation of this `DataAPITime`
   *
   * Note that it'll contain the second & nanosecond components, even if they weren't provided.
   *
   * @example
   * ```ts
   * time('12:00').toString() // '12:00:00.000000000'
   *
   * time(12, 34, 56, 78).toString() // '12:34:56.000000078'
   * ```
   *
   * @returns The string representation of this `DataAPITime`
   */
  public toString() {
    return `${this.hours.toString().padStart(2, '0')}:${this.minutes.toString().padStart(2, '0')}:${this.seconds.toString().padStart(2, '0')}.${this.nanoseconds.toString().padStart(9, '0')}`;
  }

  /**
   * ##### Overview
   *
   * Compares this `DataAPITime` to another `DataAPITime`
   *
   * @example
   * ```ts
   * time('12:00').compare(time(12, 0)) // 0
   *
   * time('12:00').compare(time(12, 1)) // -1
   *
   * time('12:01').compare(time(12, 0)) // 1
   * ```
   *
   * @param other - The other `DataAPITime` to compare to
   *
   * @returns `0` if the times are equal, `-1` if this time is before the other, and `1` if this time is after the other
   */
  public compare(other: DataAPITime): -1 | 0 | 1 {
    if (this.hours !== other.hours) {
      return this.hours < other.hours ? -1 : 1;
    }

    if (this.minutes !== other.minutes) {
      return this.minutes < other.minutes ? -1 : 1;
    }

    if (this.seconds !== other.seconds) {
      return this.seconds < other.seconds ? -1 : 1;
    }

    if (this.nanoseconds !== other.nanoseconds) {
      return this.nanoseconds < other.nanoseconds ? -1 : 1;
    }

    return 0;
  }

  /**
   * ##### Overview
   *
   * Checks if this `DataAPITime` is equal to another `DataAPITime`
   *
   * @example
   * ```ts
   * time('12:00').equals(time(12, 0)) // true
   *
   * time('12:00').equals(time(12, 1)) // false
   *
   * time('12:00').equals('12:00:00.000000000') // true
   * ```
   *
   * @param other - The other `DataAPITime` to compare to
   *
   * @returns `true` if the times are equal, and `false` otherwise
   */
  public equals(other: DataAPITime | string): boolean {
    return (other as unknown instanceof DataAPITime) && this.compare(other as DataAPITime) === 0;
  }
}

/**
 * ##### Overview
 *
 * A shorthand function-object for {@link DataAPITime}. May be used anywhere when creating new `DataAPITime`s.
 *
 * See {@link DataAPITime} and its methods for information about input parameters, formats, functions, etc.
 *
 * @example
 * ```ts
 * // equiv. to `new DataAPITime('12:34:56')`
 * time('12:34:56')
 *
 * // equiv. to `new DataAPITime(12, 34)
 * time(12, 34)
 *
 * // equiv. to `DataAPITime.now()`
 * time.now()
 * ```
 *
 * @public
 */
export const time = Object.assign(
  (...params: [string] | [Date] | [number, number, number?, number?]) => new DataAPITime(...<[any]>params),
  {
    now: DataAPITime.now,
    utcnow: DataAPITime.utcnow,
    ofNanoOfDay: DataAPITime.ofNanoOfDay,
    ofSecondOfDay: DataAPITime.ofSecondOfDay,
  },
);

const parseTimeStr = (str: string, strict: boolean): [number, number, number, number] => {
  return (strict)
    ? parseTimeStrict(str)
    : parseTimeQuick(str);
};

const parseTimeQuick = (str: string): [number, number, number, number] => {
  const hour = parseInt(str.slice(0, 2), 10);
  const minute = parseInt(str.slice(3, 5), 10);

  const second = (str.length > 5)
    ? parseInt(str.slice(6, 8), 10)
    : 0;

  const nanoseconds = (str.length > 9)
    ? parseInt(str.slice(9), 10) * Math.pow(10, 9 - (str.length - 9))
    : 0;

  return [hour, minute, second, nanoseconds];
};

const TimeRegex = /^(\d\d):(\d\d)(?::(\d\d(?:\.(\d{0,9}))?))?$/;

const parseTimeStrict = (str: string): [number, number, number, number] => {
  const match = TimeRegex.exec(str);

  if (!match) {
    throw Error(`Invalid time: '${str}'; must match HH:MM[:SS[.NNNNNNNNN]]`);
  }

  const time: [number, number, number, number] = [
    parseInt(match[1], 10),
    parseInt(match[2], 10),
    parseInt(match[3] || '0', 10),
    parseInt(match[4] || '0', 10) * Math.pow(10, 9 - (match[4]?.length ?? 0)),
  ];

  validateTime(...time);
  return time;
};

const validateTime = (hours: number, minutes: number, seconds: number, nanoseconds: number) => {
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || !Number.isInteger(seconds) || !Number.isInteger(nanoseconds)) {
    throw new TypeError(`Invalid hour: ${hours}, minute: ${minutes}, second: ${seconds}, and/or nanosecond: ${nanoseconds}; must be integers`);
  }

  if (hours < 0 || hours > 23) {
    throw RangeError(`Invalid hour: ${hours}; must be in range [0, 23]`);
  }

  if (minutes < 0 || minutes > 59) {
    throw RangeError(`Invalid minute: ${minutes}; must be in range [0, 59]`);
  }

  if (seconds < 0 || seconds > 59) {
    throw RangeError(`Invalid second: ${seconds}; must be in range [0, 59]`);
  }

  if (nanoseconds < 0 || nanoseconds > 999_999_999) {
    throw RangeError(`Invalid nanosecond: ${nanoseconds}; must be in range [0, 999,999,999]`);
  }
};

const ofSecondOfDay = (s: unknown): [number, number, number, number] => {
  if (typeof s !== 'number') {
    throw mkInvArgsErr('DataAPITime.ofSecondOfDay', [['secondOfDay', 'number']], s);
  }

  if (!Number.isInteger(s)) {
    throw new TypeError(`Invalid number of seconds: ${s}; must be an integer`);
  }
  
  if (s < 0 || 86_399 < s) {
    throw RangeError(`Invalid number of seconds: ${s}; must be in range [0, 86,399]`);
  }

  const hours = ~~(s / 3_600);
  s -= hours * 3_600;
  const minutes = ~~(s / 60);
  s -= minutes * 60;

  return [hours, minutes, s, 0];
};

const ofNanoOfDay = (ns: unknown): [number, number, number, number] => {
  if (typeof ns !== 'number') {
    throw mkInvArgsErr('DataAPITime.ofNanoOfDay', [['nanoOfDay', 'number']], ns);
  }

  if (!Number.isInteger(ns)) {
    throw new TypeError(`Invalid number of nanoseconds: ${ns}; must be an integer`);
  }

  if (ns < 0 || 86_399_999_999_999 < ns) {
    throw RangeError(`Invalid number of nanoseconds: ${ns}; must be in range [0, 86,399,999,999,999]`);
  }

  const hours = ~~(ns / 3_600_000_000_000);
  ns -= hours * 3_600_000_000_000;
  const minutes = ~~(ns / 60_000_000_000);
  ns -= minutes * 60_000_000_000;
  const seconds = ~~(ns / 1_000_000_000);
  ns -= seconds * 1_000_000_000;

  return [hours, minutes, seconds, ns];
};
