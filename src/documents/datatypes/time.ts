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
import { DataAPIDate, TableCodec, TableDesCtx, TableSerCtx } from '@/src/documents';
import { $DeserializeForTable, $SerializeForTable } from '@/src/documents/tables/ser-des/constants';
import { mkInvArgsErr } from '@/src/documents/utils';

/**
 * Represents a `time` column for Data API tables.
 *
 * You may use the {@link time} function as a shorthand for creating a new `DataAPITime`.
 *
 * See the official DataStax documentation for more information.
 *
 * @public
 */
export class DataAPITime implements TableCodec<typeof DataAPITime> {
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
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
  public static [$DeserializeForTable](_: unknown, value: any, ctx: TableDesCtx) {
    return ctx.done(new DataAPITime(value));
  }

  public static now(): DataAPITime {
    return new DataAPITime(new Date());
  }

  public static utcnow(): DataAPITime {
    return new DataAPITime(...ofNanoOfDay((Date.now() % 86_400_000) * 1_000_000));
  }

  public static ofNanoOfDay(nanoOfDay: number): DataAPITime {
    return new DataAPITime(...ofNanoOfDay(nanoOfDay));
  }

  public static ofSecondOfDay(secondOfDay: number): DataAPITime {
    return new DataAPITime(...ofSecondOfDay(secondOfDay));
  }

  public constructor(time: Date);

  public constructor(time: string, strict?: boolean);

  public constructor(hours: number, minutes: number, seconds?: number, nanoseconds?: number);

  public constructor(i1: Date | string | number, i2?: boolean | number, i3?: number, i4?: number) {
    switch (arguments.length) {
      case 1: {
        if (typeof i1 === 'string') {
          [this.hours, this.minutes, this.seconds, this.nanoseconds] = parseTimeStr(i1, true);
        }
        else if (i1 instanceof Date) {
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
   * Converts this `DataAPITime` to a `Date` object
   *
   * If no `base` date/time is provided to use the date from, the date component is set to be the current date.
   *
   * @param base - The base date/time to use for the date component
   *
   * @returns The `Date` object representing this `DataAPITime`
   */
  public toDate(base?: Date | DataAPIDate): Date {
    if (!base) {
      base = new Date();
    }

    if (base instanceof Date) {
      const ret = new Date(base);
      ret.setHours(this.hours, this.minutes, this.seconds, this.nanoseconds / 1_000_000);
      return ret;
    }

    return new Date(base.year, base.month - 1, base.date, this.hours, this.minutes, this.seconds, this.nanoseconds / 1_000_000);
  }

  /**
   * Returns the string representation of this `DataAPITime`
   *
   * @returns The string representation of this `DataAPITime`
   */
  public toString() {
    return `${this.hours < 10 ? '0' : ''}${this.hours}:${this.minutes < 10 ? '0' : ''}${this.minutes}:${this.seconds < 10 ? '0' : ''}${this.seconds}.${this.nanoseconds.toString().padStart(9, '0')}`;
  }
}

/**
 * A shorthand function for `new DataAPITime(time?)`
 *
 * If no time is provided, it defaults to the current time.
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

const parseTimeStr = (str: unknown, strict: boolean): [number, number, number, number] => {
  if (typeof str !== 'string') {
    throw mkInvArgsErr('DataAPIDate.parse', [['date', 'string']], str);
  }

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
  const match = str.match(TimeRegex);

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

const ofSecondOfDay = (s: number): [number, number, number, number] => {
  const hours = ~~(s / 3_600);
  s -= hours * 3_600;
  const minutes = ~~(s / 60);
  s -= minutes * 60;
  return [hours, minutes, s, 0];
};

const ofNanoOfDay = (ns: number): [number, number, number, number] => {
  const hours = ~~(ns / 3_600_000_000_000);
  ns -= hours * 3_600_000_000_000;
  const minutes = ~~(ns / 60_000_000_000);
  ns -= minutes * 60_000_000_000;
  const seconds = ~~(ns / 1_000_000_000);
  ns -= seconds * 1_000_000_000;
  return [hours, minutes, seconds, ns];
};
