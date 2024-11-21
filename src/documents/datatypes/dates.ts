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
import { $SerializeForTable } from '@/src/documents/tables/ser-des';
import { $SerializeForCollection } from '@/src/documents';

export const date = (date?: string | Date | DataAPIDateComponents) => new DataAPIDate(date);

export const date = (date: string | Date | DataAPIDateComponents) => new DataAPIDate(date);

export interface DataAPIDateComponents {
  year: number,
  month: number,
  date: number
}

export class DataAPIDate {
  readonly #date: string;

  public [$SerializeForTable] = this.toString;

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

  public components(): DataAPIDateComponents {
    const signum = this.#date.startsWith('-') ? -1 : 1;
    const date = this.#date.split('-');

    if (signum === -1) {
      date.shift();
    }

    return { year: +date[0], month: +date[1], date: +date[2] };
  }

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

  public toString(): string {
    return this.#date;
  }
}

export const duration = (duration: string) => new DataAPIDuration(duration);

export class DataAPIDuration {
  readonly #duration: string;

  public [$SerializeForTable] = this.toString;

  constructor(input: string) {
    this.#duration = input;

    Object.defineProperty(this, $CustomInspect, {
      value: () => `DataAPIDuration("${this.#duration}")`,
    });
  }

  public toString() {
    return this.#duration;
  }
}

export const time = (time?: string | Date | DataAPITimeComponents) => new DataAPITime(time);

export interface DataAPITimeComponents {
  hours: number,
  minutes: number,
  seconds: number,
  nanoseconds: number
}

export class DataAPITime {
  readonly #time: string;

  public [$SerializeForTable] = this.toString;

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

  public toString() {
    return this.#time;
  }
}

export const timestamp = (timestamp?: string | Date | DataAPITimestampComponents) => new DataAPITimestamp(timestamp);

export interface DataAPITimestampComponents {
  year: number,
  month: number,
  date: number,
  hours: number,
  minutes: number,
  seconds: number
  nanoseconds: number
}

export class DataAPITimestamp {
  readonly #timestamp: string;

  public [$SerializeForTable] = this.toString;
  public [$SerializeForCollection] = () => ({ $date: this.toString() });

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

  public toDate(): Date {
    return new Date(this.#timestamp);
  }

  public toString() {
    return this.#timestamp;
  }
}
