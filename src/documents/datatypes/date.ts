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
import { DataAPITime, TableCodec, TableDesCtx, TableSerCtx } from '@/src/documents';
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
  public toDate(base?: Date | DataAPITime): Date {
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
