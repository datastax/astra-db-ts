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

/**
 * A shorthand function for `new DataAPITime(time?)`
 *
 * If no time is provided, it defaults to the current time.
 *
 * @public
 */
export const time = (time?: string | Date | PartialDataAPITimeComponents) => new DataAPITime(time);

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
 * Represents the time components that make up a `DataAPITime`, with the nanoseconds being optional
 *
 * @public
 */
export type PartialDataAPITimeComponents = (Omit<DataAPITimeComponents, 'nanoseconds'> & { nanoseconds?: number });

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
  public constructor(input?: string | Date | PartialDataAPITimeComponents) {
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
  public toDate(base?: Date | DataAPIDate): Date {
    if (!base) {
      base = new Date();
    }

    const time = this.components();

    if (base instanceof Date) {
      const ret = new Date(base);
      ret.setHours(time.hours, time.minutes, time.seconds, time.nanoseconds / 1_000_000);
      return ret;
    }

    return new Date(base.year, base.month - 1, base.date, time.hours, time.minutes, time.seconds, time.nanoseconds / 1_000_000);
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
