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
import { DataAPIDuration, DataAPITime, TableCodec, TableDesCtx, TableSerCtx } from '@/src/documents';
import { $DeserializeForTable, $SerializeForTable } from '@/src/documents/tables/ser-des/constants';
import { mkInvArgsErr } from '@/src/documents/utils';

const MillisecondsPerDay = 1000 * 60 * 60 * 24;

/**
 * ##### Overview
 *
 * Represents a `date` column for Data API tables,
 *
 * ##### Format
 *
 * `date`s consist simply of a year, a month, and a date.
 *
 * - The year may be either positive or negative, and must be at least four digits long (with leading padding zeros if necessary).
 *
 * - The month must be between 1-12 (not zero-indexed like JS dates), and must be two digits long.
 *
 * - The day must be a valid day for the given month, and starts at 1. It must also be two digits long. Feb 29th is allowed on leap years
 *
 * Together, the hypothetical pseudo-regex would be as such: `[+-]?YYY(Y+)-MM-DD`.
 *
 * **Note that the `DataAPIDate`'s parser is lenient on if the leading `+` is included or not.** For example, `+2000-01-01` is accepted, even if it is not technically valid; same with `10000-01-01`. A plus will be prepended in {@link DataAPIDate.toString} as necessary.
 *
 * ##### Creation
 *
 * There are a number of different ways to initialize a `DataAPIDate`:
 *
 * @example
 * ```ts
 * // Convert a native JS `Date` to a `DataAPIDate` (extracting only the local date)
 * new DataAPIDate(new Date('2004-09-14T12:00:00.000')) // '2004-09-14'
 *
 * // Parse a date given the above date-string format
 * new DataAPIDate('+2004-09-14')
 *
 * // Create a `DataAPIDate` from a year, a month, and a date
 * new DataAPIDate(2004, 9, 14)
 *
 * // Get the current date (using the local timezone)
 * DataAPIDate.now()
 *
 * // Get the current date (using UTC)
 * DataAPIDate.utcnow()
 *
 * // Create a `DataAPIDate` from a year and a valid day of the year
 * DataAPIDate.ofYearDay(2004, 258) // '2004-09-14'
 *
 * // Create a `DataAPIDate` given the number of days since the epoch (may be negative)
 * DataAPIDate.ofEpochDay(12675) // '2004-09-14'
 * ```
 *
 * ##### The `date` shorthand
 *
 * You may use the {@link date} shorthand function-object anywhere when creating new `DataAPIDate`s.
 *
 * @example
 * ```ts
 * // equiv. to `new DataAPIDate('2004-09-14')`
 * date('2004-09-14')
 *
 * // equiv. to `new DataAPIDate(2004, 9, 14)`
 * date(2004, 9, 14)
 *
 * // equiv. to `DataAPIDate.now()`
 * date.now()
 * ```
 *
 * See the official DataStax documentation for more information.
 *
 * @see date
 *
 * @public
 */
export class DataAPIDate implements TableCodec<typeof DataAPIDate> {
  /**
   * The year component of this `DataAPIDate`.
   *
   * May be negative.
   */
  readonly year: number;

  /**
   * The month component of this `DataAPIDate`.
   *
   * Must be between 1-12.
   */
  readonly month: number;

  /**
   * The date component of this `DataAPIDate`.
   *
   * Must be a valid day for the given month.
   */
  readonly date: number;

  /**
   * Implementation of `$SerializeForTable` for {@link TableCodec}
   */
  public [$SerializeForTable](ctx: TableSerCtx) {
    return ctx.done(this.toString());
  };

  /**
   * Implementation of `$DeserializeForTable` for {@link TableCodec}
   */
  public static [$DeserializeForTable](value: string, ctx: TableDesCtx) {
    return ctx.done(new DataAPIDate(value, false));
  }

  /**
   * ##### Overview
   *
   * Returns the current date in the local timezone.
   *
   * Equivalent to `new DataAPIDate(new Date())`.
   *
   * @example
   * ```ts
   * const now = date.now();
   * // or
   * const now = DataAPIDate.now()
   * ```
   *
   * @returns The current date in the local timezone
   */
  public static now(): DataAPIDate {
    return new DataAPIDate(new Date());
  }

  /**
   * ##### Overview
   *
   * Returns the current date in UTC.
   *
   * Uses `Date.now()` under the hood.
   *
   * @example
   * ```ts
   * const now = date.utcnow();
   * // or
   * const now = DataAPIDate.utcnow()
   * ```
   *
   * @returns The current date in UTC
   */
  public static utcnow(): DataAPIDate {
    return new DataAPIDate(ofEpochDay(Math.floor(Date.now() / MillisecondsPerDay)));
  }

  /**
   * ##### Overview
   *
   * Creates a `DataAPIDate` from the number of days since the epoch.
   *
   * The number may be negative, but must be an integer within the range `[-100_000_000, 100_000_000]`.
   *
   * @example
   * ```ts
   * DataAPIDate.ofEpochDay(0) // '1970-01-01'
   *
   * date.ofEpochDay(12675) // '2004-09-14'
   *
   * date.ofEpochDay(-1) // '1969-12-31'
   * ```
   *
   * @param epochDays - The number of days since the epoch (may be negative)
   *
   * @returns The date representing the given number of days since the epoch
   */
  public static ofEpochDay(epochDays: number): DataAPIDate {
    return new DataAPIDate(ofEpochDay(epochDays));
  }

  /**
   * ##### Overview
   *
   * Creates a `DataAPIDate` from a year and a valid day of the year.
   *
   * The year may be negative.
   *
   * The day-of-year must be valid for the year, otherwise an exception will be thrown.
   *
   * @example
   * ```ts
   * DataAPIDate.ofYearDay(2004, 258) // 2004-09-14
   *
   * date.ofYearDay(2004, 1) // 2004-01-01
   *
   * date.ofYearDay(2004, 366) // 2004-12-31 (ok b/c 2004 is a leap year)
   * ```
   *
   * @param year - The year to use
   * @param dayOfYear - The day of the year to use (1-indexed)
   *
   * @returns The date representing the given year and day of the year
   */
  public static ofYearDay(year: number, dayOfYear: number): DataAPIDate {
    return new DataAPIDate(ofYearDay(year, dayOfYear));
  }

  /**
   * ##### Overview
   *
   * Converts a native JS `Date` to a `DataAPIDate` (extracting only the local date).
   *
   * @example
   * ```ts
   * new DataAPIDate(new Date('2004-09-14T12:00:00.000')) // '2004-09-14'
   *
   * date(new Date('-200004-09-14')) // '200004-09-14'
   * ```
   *
   * @param date - The `Date` object to convert
   */
  public constructor(date: Date);

  /**
   * ##### Overview
   *
   * Parses a `DataAPIDate` from a string in the format `[+-]?YYY(Y+)-MM-DD`.
   *
   * See {@link DataAPIDate} for more info about the exact format.
   *
   * @example
   * ```ts
   * new DataAPIDate('2004-09-14') // '2004-09-14'
   *
   * date('-2004-09-14') // '-2004-09-14'
   *
   * date('+123456-09-14') // '123456-09-14'
   * ```
   *
   * @param date - The date to parse
   */
  public constructor(date: string);

  /**
   * Should not be called by user directly.
   *
   * @internal
   */
  public constructor(time: string, strict: boolean);

  /**
   * ##### Overview
   *
   * Creates a `DataAPIDate` from a year, a month, and a date.
   *
   * The year may be negative. The month and day are both 1-indexed.
   *
   * The date must be valid for the given month, otherwise an exception will be thrown.
   *
   * @example
   * ```ts
   * new DataAPIDate(2004, 9, 14) // '2004-09-14'
   *
   * date(-200004, 9, 14) // '-200004-09-14'
   * ```
   *
   * @param year - The year to use
   * @param month - The month to use (1-indexed)
   * @param date - The date to use (1-indexed)
   */
  public constructor(year: number, month: number, date: number);

  public constructor(i1: string | Date | number, i2?: number | boolean, i3?: number) {
    switch (arguments.length) {
      case 1: case 2: {
        if (typeof i1 === 'string') {
          [this.year, this.month, this.date] = parseDateStr(i1, i2 !== false);
        }
        else if (i1 instanceof Date) {
          if (isNaN(i1.getTime())) {
            throw new Error(`Invalid date '${i1.toString()}'; must be a valid (non-NaN) date`);
          }
          this.year = i1.getFullYear();
          this.month = i1.getMonth() + 1;
          this.date = i1.getDate();
        }
        else {
          throw mkInvArgsErr('new DataAPIDate', [['date', 'string | Date']], i1);
        }
        break;
      }
      case 3: {
        if (typeof i1 !== 'number' || typeof i2 !== 'number' || typeof i3 !== 'number') {
          throw mkInvArgsErr('new DataAPIDate', [['year', 'number'], ['month', 'number'], ['date', 'number']], i1, i2, i3);
        }
        validateDate(1, i1, i2, i3);
        this.year = i1;
        this.month = i2;
        this.date = i3;
        break;
      }
      default: {
        throw RangeError(`Invalid number of arguments; expected 1..=3, got ${arguments.length}`);
      }
    }

    Object.defineProperty(this, $CustomInspect, {
      value: () => `DataAPIDate("${this.toString()}")`,
    });
  }

  /**
   * ##### Overview
   *
   * Converts this `DataAPIDate` to a `Date` object in the local timezone.
   *
   * If no `base` date/time is provided, the time component defaults to `00:00:00` (local time).
   *
   * If the `base` parameter is a `DataAPITime`, it is interpreted as being in the local timezone, not UTC.
   *
   * See {@link DataAPIDate.toDateUTC} for a UTC-based alternative to this method.
   *
   * @example
   * ```ts
   * // Assuming the local timezone is UTC-6 (CST) //
   *
   * // Local Time: '2000-01-01T12:00:00'
   * // UTC Time:   '2000-01-01T18:00:00Z'
   * date('2000-01-01').toDate(new Date('1970-01-01T12:00:00'));
   *
   * // Local Time: '2000-01-01T06:00:00'
   * // UTC Time:   '2000-01-01T12:00:00Z'
   * date('2000-01-01').toDate(new Date('1970-01-01T12:00:00Z'));
   *
   * // Local Time: '2000-01-01T12:00:00'
   * // UTC Time:   '2000-01-01T18:00:00Z'
   * date('2000-01-01').toDate(new DataAPITime('12:00:00'));
   *
   * // Local Time: '2000-01-01T00:00:00'
   * // UTC Time:   '2000-01-01T06:00:00Z'
   * date('2000-01-01').toDate();
   * ```
   *
   * @param base - The base date/time to use for the time component. If omitted, defaults to `00:00:00` (local time).
   *
   * @returns The `Date` object representing this `DataAPIDate` in the local timezone.
   *
   * @see DataAPIDate.toDateUTC
   */
  public toDate(base?: Date | DataAPITime): Date {
    if (!base || base instanceof Date) {
      return new Date(this.year, this.month - 1, this.date, base?.getHours() || 0, base?.getMinutes() || 0, base?.getSeconds() || 0, base?.getMilliseconds() || 0);
    }
    return new Date(this.year, this.month - 1, this.date, base.hours, base.minutes, base.seconds, base.nanoseconds / 1_000_000);
  }

  /**
   * ##### Overview
   *
   * Converts this `DataAPIDate` to a `Date` object in UTC.
   *
   * If no `base` date/time is provided, the time component defaults to `00:00:00` (UTC).
   *
   * If the `base` parameter is a `DataAPITime`, it is interpreted as being in the UTC timezone.
   *
   * See {@link DataAPIDate.toDate} for a local-time-based alternative to this method.
   *
   * @example
   * ```ts
   * // Assuming the local timezone is UTC-6 (CST) //
   *
   * // Local Time: '2000-01-01T12:00:00'
   * // UTC Time:   '2000-01-01T18:00:00Z'
   * date('2000-01-01').toDateUTC(new Date('1970-01-01T12:00:00'));
   *
   * // Local Time: '2000-01-01T06:00:00'
   * // UTC Time:   '2000-01-01T12:00:00Z'
   * date('2000-01-01').toDateUTC(new Date('1970-01-01T12:00:00Z'));
   *
   * // Local Time: '2000-01-01T12:00:00'
   * // UTC Time:   '2000-01-01T18:00:00Z'
   * date('2000-01-01').toDateUTC(new DataAPITime('12:00:00'));
   *
   * // Local Time: '1999-12-31T18:00:00'
   * // UTC Time:   '2000-01-01T00:00:00Z'
   * date('2000-01-01').toDateUTC();
   * ```
   *
   * @param base - The base time to use for the time component. If omitted, defaults to `00:00:00` UTC.
   *
   * @returns The `Date` object representing this `DataAPIDate` in UTC.
   *
   * @see DataAPIDate.toDate
   */
  public toDateUTC(base?: Date | DataAPITime): Date {
    if (!base || base instanceof Date) {
      return new Date(Date.UTC(this.year, this.month - 1, this.date, base?.getUTCHours() || 0, base?.getUTCMinutes() || 0, base?.getUTCSeconds() || 0, base?.getUTCMilliseconds() || 0));
    }
    return new Date(Date.UTC(this.year, this.month - 1, this.date, base.hours, base.minutes, base.seconds, base.nanoseconds / 1_000_000));
  }

  /**
   * ##### Overview
   *
   * Adds a {@link DataAPIDuration} or a duration string to this `DataAPIDate`.
   *
   * Duration strings will be parsed into a {@link DataAPIDuration} before being added.
   *
   * Durations may be negative, in which case the duration will be subtracted from this date.
   *
   * @example
   * ```ts
   * date('2000-01-01').plus('1y47h59m') // '2001-01-02'
   *
   * date('2000-01-01').plus('365d') // '2000-12-31'
   *
   * date('2000-01-01').plus('366d') // '2001-01-01'
   * ```
   *
   * @param duration - The duration to add to this `DataAPIDate`
   *
   * @returns A new `DataAPIDate` representing the result of adding the duration to this date
   */
  public plus(duration: DataAPIDuration | string): DataAPIDate {
    if (typeof duration === 'string') {
      duration = new DataAPIDuration(duration);
    }

    const date = new Date(this.year, this.month - 1, this.date);

    date.setDate(date.getDate() + duration.days);
    date.setMonth(date.getMonth() + duration.months);
    date.setMilliseconds(date.getMilliseconds() + duration.toMillis());

    if (isNaN(date.getTime())) {
      throw new RangeError(`Invalid date resulting from adding duration '${duration.toString()}' to '${this.toString()}'`);
    }

    return new DataAPIDate(date);
  }

  /**
   * ##### Overview
   *
   * Returns the string representation of this `DataAPIDate`
   *
   * Note that a `+` is prepended to the year if it is greater than or equal to 10000.
   *
   * @example
   * ```ts
   * date('2004-09-14').toString() // '2004-09-14'
   *
   * date(-2004, 9, 14).toString() // '-2004-09-14'
   *
   * date('123456-01-01').toString() // '+123456-01-01'
   * ```
   *
   * @returns The string representation of this `DataAPIDate`
   */
  public toString(): string {
    const sign = (this.year < 0) ? '-' : (this.year >= 10000) ? '+' : '';
    return `${sign}${Math.abs(this.year).toString().padStart(4, '0')}-${this.month.toString().padStart(2, '0')}-${this.date.toString().padStart(2, '0')}`;
  }

  /**
   * ##### Overview
   *
   * Compares this `DataAPIDate` to another `DataAPIDate`
   *
   * @example
   * ```ts
   * date('2004-09-14').compare(date(2004, 9, 14)) // 0
   *
   * date('2004-09-14').compare(date(2004, 9, 15)) // -1
   *
   * date('2004-09-15').compare(date(2004, 9, 14)) // 1
   * ```
   *
   * @param other - The other `DataAPIDate` to compare to
   *
   * @returns `0` if the dates are equal, `-1` if this date is before the other, and `1` if this date is after the other
   */
  public compare(other: DataAPIDate): -1 | 0 | 1 {
    if (this.year !== other.year) {
      return this.year < other.year ? -1 : 1;
    }

    if (this.month !== other.month) {
      return this.month < other.month ? -1 : 1;
    }

    if (this.date !== other.date) {
      return this.date < other.date ? -1 : 1;
    }

    return 0;
  }

  /**
   * ##### Overview
   *
   * Checks if this `DataAPIDate` is equal to another `DataAPIDate`
   *
   * @example
   * ```ts
   * date('2004-09-14').equals(date(2004, 9, 14)) // true
   *
   * date('2004-09-14').equals(date(2004, 9, 15)) // false
   *
   * date('2004-09-15').equals(date(2004, 9, 14)) // false
   * ```
   *
   * @param other - The other `DataAPIDate` to compare to
   *
   * @returns `true` if the dates are equal, and `false` otherwise
   */
  public equals(other: DataAPIDate): boolean {
    return (other as unknown instanceof DataAPIDate) && this.compare(other) === 0;
  }
}

/**
 * ##### Overview
 *
 * A shorthand function-object for {@link DataAPIDate}. May be used anywhere when creating new `DataAPIDate`s.
 *
 * See {@link DataAPIDate} and its methods for information about input parameters, formats, functions, etc.
 *
 * @example
 * ```ts
 * // equiv. to `new DataAPIDate('2004-09-14')`
 * date('2004-09-14')
 *
 * // equiv. to `new DataAPIDate(2004, 9, 14)`
 * date(2004, 9, 14)
 *
 * // equiv. to `DataAPIDate.now()`
 * date.now()
 * ```
 *
 * @public
 */
export const date = Object.assign(
  (...params: [string] | [Date] | [number, number, number]) => new DataAPIDate(...<[any]>params),
  {
    now: DataAPIDate.now,
    utcnow: DataAPIDate.utcnow,
    ofEpochDay: DataAPIDate.ofEpochDay,
    ofYearDay: DataAPIDate.ofYearDay,
  },
);

const parseDateStr = (str: string, strict: boolean): [number, number, number] => {
  return (strict)
    ? parseDateStrict(str)
    : parseDateQuick(str);
};

const parseDateQuick = (str: string): [number, number, number] => {
  const sign = (str[0] === '-') ? -1 : 1;
  const startIndex = (str[0] === '+' || str[0] === '-') ? 1 : 0;

  const yearStr = str.substring(startIndex, str.indexOf('-', startIndex + 1));
  const yearStrEnd = startIndex + yearStr.length;

  const year  = parseInt(yearStr, 10);
  const month = parseInt(str.slice(yearStrEnd + 1, yearStr.length + 4), 10);
  const date  = parseInt(str.slice(yearStrEnd + 4, yearStr.length + 7), 10);

  return [sign * year, month, date];
};

const DateRegex = /^([-+])?(\d{4,})-(\d{2})-(\d{2})$/;

const parseDateStrict = (str: string): [number, number, number] => {
  const match = str.match(DateRegex);

  if (!match) {
    throw new Error(`Invalid date string '${str}'; must be in the format [+-]?YYY(Y+)-MM-DD, with zero-padded numbers as necessary`);
  }

  const sign = (match[1] === '-') ? -1 : 1;
  const ymd = [sign * parseInt(match[2], 10), parseInt(match[3], 10), parseInt(match[4], 10)] as [number, number, number];

  validateDate(sign, ymd[0], ymd[1], ymd[2]);
  return ymd;
};

const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

const DaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DaysInMonthLeap = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const validateDate = (sign: number, year: number, month: number, date: number): void => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(date)) {
    throw new TypeError(`Invalid year: ${year}, month: ${month}, and/or date: ${date}; must be integers`);
  }

  if (month < 1 || 12 < month) {
    throw new RangeError(`Invalid month: ${month}; month must be between 1 and 12 (DataAPIDate's month is NOT zero-indexed)`);
  }

  const dim = isLeapYear(year) ? DaysInMonthLeap : DaysInMonth;

  if (date <= 0 || dim[month - 1] < date) {
    throw new RangeError(`Invalid date: ${date}; must be between 1 and ${dim[month - 1]} for month ${month} in year ${year}`);
  }

  if (sign < 0 && year === 0) {
    throw new RangeError(`Invalid year: ${year}; year may not be 0 for negative dates`);
  }
};

const ofYearDay = (year: unknown, dayOfYear: unknown): Date => {
  if (typeof year !== 'number' || typeof dayOfYear !== 'number') {
    throw mkInvArgsErr('DataAPIDate.ofYearDay', [['year', 'number'], ['dayOfYear', 'number']], year, dayOfYear);
  }

  if (!Number.isInteger(year) || !Number.isInteger(dayOfYear)) {
    throw new TypeError(`Invalid year: ${year} and/or dayOfYear: ${dayOfYear}; must be integers`);
  }

  if (dayOfYear < 1 || 365 + (isLeapYear(year) ? 1 : 0) < dayOfYear) {
    throw new RangeError(`Invalid dayOfYear: ${dayOfYear}; must be between 1 and ${365 + (isLeapYear(year) ? 1 : 0)} for year ${year}`);
  }

  const date = new Date(0);
  date.setUTCFullYear(year, 0, dayOfYear);

  if (isNaN(date.getTime())) {
    throw new RangeError(`Invalid year: ${year}; must be within range [-271821, 275760] if using date.ofYearDay; use the DataAPIDate constructor directly for larger values`);
  }

  return date;
};

const ofEpochDay = (epochDays: unknown): Date => {
  if (typeof epochDays !== 'number') {
    throw mkInvArgsErr('DataAPIDate.ofEpochDay', [['epochDays', 'number']], epochDays);
  }

  if (!Number.isInteger(epochDays)) {
    throw new TypeError(`Invalid epochDays: ${epochDays}; must be an integer`);
  }

  if (epochDays < -100_000_000 || 100_000_000 < epochDays) {
    throw new RangeError(`Invalid epochDays: ${epochDays}; must be within range [-100_000_000, 100_000_000] if using date.ofEpochDay; use the DataAPIDate constructor directly for larger values`);
  }

  return new Date(epochDays * MillisecondsPerDay);
};
