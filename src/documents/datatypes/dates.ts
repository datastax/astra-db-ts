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

import { $SerializeRelaxed } from '@/src/lib';

export interface CqlDateComponents {
  year: number,
  month: number,
  date: number
}

export class CqlDate {
  readonly #date: string;

  public constructor(input: string | Date | CqlDateComponents) {
    if (typeof input === 'string') {
      this.#date = input;
    } else if (input instanceof Date) {
      this.#date = `${input.getFullYear()}-${input.getMonth() + 1}-${input.getDate()}`;
    } else {
      this.#date = `${input.year}-${input.month}-${input.date}`;
    }

    Object.defineProperty(this, $SerializeRelaxed, {
      value: this.toString,
    });
  }

  public components(): CqlDateComponents {
    const [year, month, day] = this.#date.split('-');
    return { year: +year, month: +month, date: +day };
  }

  public toDate(): Date {
    const [year, month, day] = this.#date.split('-');
    return new Date(+year, +month - 1, +day);
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

  constructor(input: string | CqlDurationComponents) {
    if (typeof input === 'string') {
      this.#duration = input;
    } else {
      this.#duration = `${input.months}mo${input.days}d${input.nanoseconds}ns`;
    }

    Object.defineProperty(this, $SerializeRelaxed, {
      value: this.toString,
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

  public constructor(input: string | Date | CqlTimeComponents) {
    if (typeof input === 'string') {
      this.#time = input;
    } else if (input instanceof Date) {
      const ms = input.getMilliseconds();

      if (ms) {
        this.#time = `${input.getHours()}:${input.getMinutes()}:${input.getSeconds()}.${input.getMilliseconds() * 1000}`;
      } else {
        this.#time = `${input.getHours()}:${input.getMinutes()}:${input.getSeconds()}`;
      }
    } else {
      if (input.nanoseconds) {
        this.#time = `${input.hours}:${input.minutes}:${input.seconds}.${input.nanoseconds}`;
      } else {
        this.#time = `${input.hours}:${input.minutes}:${input.seconds}`;
      }
    }

    Object.defineProperty(this, $SerializeRelaxed, {
      value: this.toString,
    });
  }

  public components(): CqlTimeComponents {
    const [timePart, fractionPart] = this.#time.split('.');
    const [hours, mins, secs] = timePart.split(':');

    return {
      hours: +hours,
      minutes: +mins,
      seconds: +secs,
      nanoseconds: fractionPart ? +fractionPart : 0,
    };
  }

  public toDate(): Date {
    const [timePart, fractionPart] = this.#time.split('.');
    const [hours, mins, secs] = timePart.split(':');

    const date = new Date();
    date.setHours(+hours);
    date.setMinutes(+mins);
    date.setSeconds(+secs);
    date.setMilliseconds(fractionPart ? +fractionPart / 1000 : 0);

    return date;
  }

  public toString() {
    return this.#time;
  }
}

export interface CqlTimestampComponents {
  year: number,
  month: number,
  date?: number,
  hours?: number,
  minutes?: number,
  seconds?: number
  ms?: number
}

export class CqlTimestamp {
  readonly #timestamp: string;

  public constructor(input: string | Date | CqlTimestampComponents) {
    if (typeof input === 'string') {
      this.#timestamp = input;
    } else if (input instanceof Date) {
      this.#timestamp = input.toISOString();
    } else {
      this.#timestamp = new Date(input.year, input.month - 1, input.date, input.hours, input.minutes, input.seconds, input.ms).toISOString();
    }

    Object.defineProperty(this, $SerializeRelaxed, {
      value: this.toString,
    });
  }

  public components(): CqlDurationComponents {
    throw 'stub';
  }

  public toDate(): Date {
    return new Date(this.#timestamp);
  }

  public toString() {
    return this.#timestamp;
  }
}
