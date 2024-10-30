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
import { $SerializeForTables } from '@/src/documents/tables/ser-des';

export interface CqlDateComponents {
  year: number,
  month: number,
  date: number
}

export class CqlDate {
  readonly #date: string;

  public [$SerializeForTables] = this.toString;

  public constructor(input?: string | Date | Partial<CqlDateComponents>) {
    if (typeof input === 'string') {
      this.#date = input;
    } else if (input instanceof Date || isNullish(input)) {
      input ||= new Date();
      this.#date = `${input.getFullYear()}-${input.getMonth() + 1}-${input.getDate()}`;
    } else {
      if (input.month && (input.month < 1 || input.month > 12)) {
        throw new RangeError('Month must be between 1 and 12 (CqlDate month is NOT zero-indexed)');
      }
      this.#date = `${input.year ?? '0000'}-${input.month ?? '00'}-${input.date ?? '00'}`;
    }

    Object.defineProperty(this, $CustomInspect, {
      value: () => `CqlDate("${this.#date}")`,
    });
  }

  public components(): CqlDateComponents {
    const signum = this.#date.startsWith('-') ? -1 : 1;
    const date = this.#date.split('-');

    if (signum === -1) {
      date.shift();
    }

    return { year: +date[0], month: +date[1], date: +date[2] };
  }

  public toDate(base?: Date | CqlTime | CqlTimestamp): Date {
    if (base instanceof CqlTimestamp) {
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


export interface CqlDurationComponents {
  months: number,
  days: number,
  nanoseconds: number,
}

export class CqlDuration {
  readonly #duration: string;

  public [$SerializeForTables] = this.toString;

  constructor(input: string | CqlDurationComponents) {
    if (typeof input === 'string') {
      this.#duration = input;
    } else {
      this.#duration = `${input.months}mo${input.days}d${input.nanoseconds}ns`;
    }

    Object.defineProperty(this, $CustomInspect, {
      value: () => `CqlDuration("${this.#duration}")`,
    });
  }

  public components(): CqlDurationComponents {
    throw 'stub';
  }

  public toString() {
    return this.#duration;
  }
}

export interface CqlTimeComponents {
  hours: number,
  minutes: number,
  seconds: number,
  nanoseconds: number
}

export class CqlTime {
  readonly #time: string;

  public [$SerializeForTables] = this.toString;

  public constructor(input?: string | Date | Partial<CqlTimeComponents>) {
    input ||= new Date();

    if (typeof input === 'string') {
      this.#time = input;
    } else if (input instanceof Date) {
      this.#time = CqlTime.#initTime(input.getHours(), input.getMinutes(), input.getSeconds(), input.getMilliseconds());
    } else {
      this.#time = CqlTime.#initTime(input.hours, input.minutes, input.seconds, input.nanoseconds ? input.nanoseconds.toString().padStart(9, '0') : '');
    }

    Object.defineProperty(this, $CustomInspect, {
      value: () => `CqlTime("${this.#time}")`,
    });
  }

  static #initTime(hours?: number, minutes?: number, seconds?: number, fractional?: unknown): string {
    return `${!hours || hours < 10 ? '0' : ''}${hours}:${!minutes || minutes < 10 ? '0' : ''}${minutes}:${!seconds || seconds < 10 ? '0' : ''}${seconds}${fractional ? `.${fractional}` : ''}`;
  }

  public components(): CqlTimeComponents {
    const [timePart, fractionPart] = this.#time.split('.');
    const [hours, mins, secs] = timePart.split(':');

    return {
      hours: +hours,
      minutes: +mins,
      seconds: +secs,
      nanoseconds: +fractionPart.padEnd(9, '0'),
    };
  }

  public toDate(base?: Date | CqlDate | CqlTimestamp): Date {
    if (base instanceof CqlTimestamp) {
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

export interface CqlTimestampComponents {
  year: number,
  month: number,
  date: number,
  hours: number,
  minutes: number,
  seconds: number
  nanoseconds: number
}

export class CqlTimestamp {
  readonly #timestamp: string;

  public [$SerializeForTables] = this.toString;

  public constructor(input?: string | Date | Partial<CqlTimestampComponents>) {
    input ||= new Date();

    if (typeof input === 'string') {
      this.#timestamp = input;
    } else if (input instanceof Date) {
      this.#timestamp = input.toISOString();
    } else {
      this.#timestamp = new Date(input.year ?? 0, input.month ?? 1 - 1, input.date, input.hours, input.minutes, input.seconds, input.nanoseconds ?? 0 / 1_000_000).toISOString();
    }

    Object.defineProperty(this, $SerializeForTables, {
      value: () => `CqlTimestamp("${this.#timestamp}")`,
    });
  }

  public components(): CqlTimestampComponents {
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
