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

import { isNullish } from '@/src/lib/utils';
import { $CustomInspect } from '@/src/lib/constants';
import { CollCodec, CollDesCtx, CollSerCtx, TableCodec, TableDesCtx, TableSerCtx } from '@/src/documents';
import { $DeserializeForCollection, $SerializeForCollection } from '@/src/documents/collections/ser-des/constants';
import { $DeserializeForTable, $SerializeForTable } from '@/src/documents/tables/ser-des/constants';

/**
 * A shorthand function for `new DataAPIDate(date?)`
 *
 * If no date is provided, it defaults to the current date.
 *
 * @public
 */
export const date = (date?: string | Date | DataAPIDateComponents) => new DataAPIDate(date);

/**
 * Represents the time components that make up a `DataAPIDate`
 *
 * @public
 */
export interface DataAPIDateComponents {
  /**
   * The year of the date
   */
  year: number,
  /**
   * The month of the date (should be between 1 and 12)
   */
  month: number,
  /**
   * The day of the month
   */
  date: number,
}

/**
 * Represents a `date` column for Data API tables.
 *
 * You may use the {@link date} function as a shorthand for creating a new `DataAPIDate`.
 *
 * See the official DataStax documentation for more information.
 *
 * @public
 */
export class DataAPIDate implements TableCodec<typeof DataAPIDate> {
  readonly #date: string;

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
    return ctx.done(new DataAPIDate(value));
  }

  /**
   * Creates a new `DataAPIVector` instance from various formats.
   *
   * @param input - The input to create the `DataAPIDate` from
   */
  public constructor(input?: string | Date | DataAPIDateComponents) {
    if (typeof input === 'string') {
      this.#date = input;
    } else if (input instanceof Date || isNullish(input)) {
      input ||= new Date();
      this.#date = `${input.getFullYear().toString().padStart(4, '0')}-${(input.getMonth() + 1).toString().padStart(2, '0')}-${input.getDate().toString().padStart(2, '0')}`;
    } else {
      if (input.month < 1 || input.month > 12) {
        throw new RangeError('Month must be between 1 and 12 (DataAPIDate month is NOT zero-indexed)');
      }
      this.#date = `${input.year.toString().padStart(4, '0') ?? '0000'}-${input.month.toString().padStart(2, '0') ?? '00'}-${input.date.toString().padStart(2, '0') ?? '00'}`;
    }

    Object.defineProperty(this, $CustomInspect, {
      value: () => `DataAPIDate("${this.#date}")`,
    });
  }

  /**
   * Returns the {@link DataAPIDateComponents} that make up this `DataAPIDate`
   *
   * @returns The components of the date
   */
  public components(): DataAPIDateComponents {
    const signum = this.#date.startsWith('-') ? -1 : 1;
    const date = this.#date.split('-');

    if (signum === -1) {
      date.shift();
    }

    return { year: +date[0], month: +date[1], date: +date[2] };
  }

  /**
   * Converts this `DataAPIDate` to a `Date` object
   *
   * If no `base` date/time is provided to use the time from, the time component is set to be the current time.
   *
   * @param base - The base date/time to use for the time component
   *
   * @returns The `Date` object representing this `DataAPIDate`
   */
  public toDate(base?: Date | DataAPITime | DataAPITimestamp): Date {
    if (base instanceof DataAPITimestamp) {
      base = base.toDate();
    }

    if (!base) {
      base = new Date();
    }

    const date = this.components();

    if (base instanceof Date) {
      const ret = new Date(base);
      ret.setFullYear(date.year, date.month - 1, date.date);
      return ret;
    }

    const time = base.components();

    return new Date(date.year, date.month - 1, date.date, time.hours, time.minutes, time.seconds, time.nanoseconds / 1_000_000);
  }

  /**
   * Returns the string representation of this `DataAPIDate`
   *
   * @returns The string representation of this `DataAPIDate`
   */
  public toString(): string {
    return this.#date;
  }
}

/**
 * A shorthand function for `new DataAPIDuration(duration)`
 *
 * @public
 */
export const duration = (duration: string) => new DataAPIDuration(duration);

/**
 * Represents a `duration` column for Data API tables.
 *
 * You may use the {@link duration} function as a shorthand for creating a new `DataAPIDuration`.
 *
 * See the official DataStax documentation for more information.
 *
 * @public
 */
export class DataAPIDuration implements TableCodec<typeof DataAPIDuration> {
  readonly #duration: string;

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
    return ctx.done(new DataAPIDuration(value));
  }

  /**
   * Creates a new `DataAPIDuration` instance from a duration string.
   *
   * @param input - The duration string to create the `DataAPIDuration` from
   */
  constructor(input: string) {
    this.#duration = input;

    Object.defineProperty(this, $CustomInspect, {
      value: () => `DataAPIDuration("${this.#duration}")`,
    });
  }

  /**
   * Returns the string representation of this `DataAPIDuration`
   *
   * @returns The string representation of this `DataAPIDuration`
   */
  public toString() {
    return this.#duration;
  }
}

/**
 * A shorthand function for `new DataAPITime(time?)`
 *
 * If no time is provided, it defaults to the current time.
 *
 * @public
 */
export const time = (time?: string | Date | DataAPITimeComponents) => new DataAPITime(time);

/**
 * Represents the time components that make up a `DataAPITime`
 *
 * @public
 */
export interface DataAPITimeComponents {
  /**
   * The hour of the time
   */
  hours: number,
  /**
   * The minute of the time
   */
  minutes: number,
  /**
   * The second of the time
   */
  seconds: number,
  /**
   * The nanosecond of the time
   */
  nanoseconds: number
}

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
  readonly #time: string;

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

  /**
   * Creates a new `DataAPITime` instance from various formats.
   *
   * @param input - The input to create the `DataAPITime` from
   */
  public constructor(input?: string | Date | (DataAPITimeComponents & { nanoseconds?: number })) {
    input ||= new Date();

    if (typeof input === 'string') {
      this.#time = input;
    } else if (input instanceof Date) {
      this.#time = DataAPITime.#initTime(input.getHours(), input.getMinutes(), input.getSeconds(), input.getMilliseconds());
    } else {
      this.#time = DataAPITime.#initTime(input.hours, input.minutes, input.seconds, input.nanoseconds ? input.nanoseconds.toString().padStart(9, '0') : '');
    }

    Object.defineProperty(this, $CustomInspect, {
      value: () => `DataAPITime("${this.#time}")`,
    });
  }

  static #initTime(hours: number, minutes: number, seconds: number, fractional?: unknown): string {
    return `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}${fractional ? `.${fractional}` : ''}`;
  }

  /**
   * Returns the {@link DataAPITimeComponents} that make up this `DataAPITime`
   *
   * @returns The components of the time
   */
  public components(): DataAPITimeComponents {
    const [timePart, fractionPart] = this.#time.split('.');
    const [hours, mins, secs] = timePart.split(':');

    return {
      hours: +hours,
      minutes: +mins,
      seconds: +secs,
      nanoseconds: +fractionPart.padEnd(9, '0'),
    };
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
  public toDate(base?: Date | DataAPIDate | DataAPITimestamp): Date {
    if (base instanceof DataAPITimestamp) {
      base = base.toDate();
    }

    if (!base) {
      base = new Date();
    }

    const time = this.components();

    if (base instanceof Date) {
      const ret = new Date(base);
      ret.setHours(time.hours, time.minutes, time.seconds, time.nanoseconds / 1_000_000);
      return ret;
    }

    const date = base.components();

    return new Date(date.year, date.month - 1, date.date, time.hours, time.minutes, time.seconds, time.nanoseconds / 1_000_000);
  }

  /**
   * Returns the string representation of this `DataAPITime`
   *
   * @returns The string representation of this `DataAPITime`
   */
  public toString() {
    return this.#time;
  }
}

/**
 * A shorthand function for `new DataAPITimestamp(timestamp?)`
 *
 * If no timestamp is provided, it defaults to the current timestamp.
 *
 * @public
 */
export const timestamp = (timestamp?: string | Date | DataAPITimestampComponents) => new DataAPITimestamp(timestamp);

/**
 * Represents the time components that make up a `DataAPITimestamp`
 *
 * @public
 */
export interface DataAPITimestampComponents {
  /**
   * The year of the timestamp
   */
  year: number,
  /**
   * The month of the timestamp (should be between 1 and 12)
   */
  month: number,
  /**
   * The day of the month
   */
  date: number,
  /**
   * The hour of the timestamp
   */
  hours: number,
  /**
   * The minute of the timestamp
   */
  minutes: number,
  /**
   * The second of the timestamp
   */
  seconds: number,
  /**
   * The nanosecond of the timestamp
   */
  nanoseconds: number,
}

/**
 * Represents a `timestamp` column for Data API tables.
 *
 * You may use the {@link timestamp} function as a shorthand for creating a new `DataAPITimestamp`.
 *
 * See the official DataStax documentation for more information.
 *
 * @public
 */
export class DataAPITimestamp implements CollCodec<typeof DataAPITimestamp>, TableCodec<typeof DataAPITimestamp> {
  readonly #timestamp: string;

  /**
   * Implementation of `$SerializeForTable` for {@link TableCodec}
   */
  public [$SerializeForTable](ctx: TableSerCtx) {
    return ctx.done(this.#timestamp);
  };

  /**
   * Implementation of `$SerializeForCollection` for {@link TableCodec}
   */
  public [$SerializeForCollection](ctx: CollSerCtx) {
    return ctx.done({ $date: new Date(this.#timestamp).valueOf() });
  };

  /**
   * Implementation of `$DeserializeForTable` for {@link TableCodec}
   */
  public static [$DeserializeForTable](_: unknown, value: any, ctx: TableDesCtx) {
    return ctx.done(new DataAPITimestamp(value));
  }

  /**
   * Implementation of `$DeserializeForCollection` for {@link TableCodec}
   */
  public static [$DeserializeForCollection](_: string, value: any, ctx: CollDesCtx) {
    return ctx.done(new DataAPITimestamp(new Date(value.$date).toISOString()));
  }

  /**
   * Creates a new `DataAPITimestamp` instance from various formats.
   *
   * @param input - The input to create the `DataAPITimestamp` from
   */
  public constructor(input?: string | Date | Partial<DataAPITimestampComponents>) {
    input ||= new Date();

    if (typeof input === 'string') {
      this.#timestamp = input;
    } else if (input instanceof Date) {
      this.#timestamp = input.toISOString();
    } else {
      this.#timestamp = new Date(input.year ?? 0, input.month ?? 1 - 1, input.date, input.hours, input.minutes, input.seconds, input.nanoseconds ?? 0 / 1_000_000).toISOString();
    }

    Object.defineProperty(this, $CustomInspect, {
      value: () => `DataAPITimestamp("${this.#timestamp}")`,
    });
  }

  /**
   * Returns the {@link DataAPITimestampComponents} that make up this `DataAPITimestamp`
   *
   * @returns The components of the timestamp
   */
  public components(): DataAPITimestampComponents {
    const date = this.toDate();
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      date: date.getDate(),
      hours: date.getHours(),
      minutes: date.getMinutes(),
      seconds: date.getSeconds(),
      nanoseconds: date.getMilliseconds() * 1_000_000,
    };
  }

  /**
   * Converts this `DataAPITimestamp` to a `Date` object
   *
   * @returns The `Date` object representing this `DataAPITimestamp`
   */
  public toDate(): Date {
    return new Date(this.#timestamp);
  }

  /**
   * Returns the string representation of this `DataAPITimestamp`
   *
   * @returns The string representation of this `DataAPITimestamp`
   */
  public toString() {
    return this.#timestamp;
  }
}
