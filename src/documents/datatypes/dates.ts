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

export interface CqlDateComponents {
  year: number,
  month: number,
  date: number
}

export class CqlDate {
  readonly #year: number;
  readonly #month: number;
  readonly #date: number;

  constructor(input: string | Date | CqlDateComponents) {
    if (typeof input === 'string') {
      const [year, month, day] = input.split('-');
      this.#year = +year;
      this.#month = +month - 1;
      this.#date = +day;
    } else if (input instanceof Date) {
      this.#year = input.getFullYear();
      this.#month = input.getMonth();
      this.#date = input.getDate();
    } else {
      this.#year = +input.year;
      this.#month = +input.month - 1;
      this.#date = +input.date;
    }
  }

  toDate(): Date {
    return new Date(this.#year, this.#month, this.#date);
  }
}

export interface CqlDurationComponents {
  years?: number,
  months?: number,
  days?: number,
  hours?: number,
  minutes?: number,
  seconds?: number
}

export class CqlDuration {
  #years: number = 0;
  #months: number = 0;
  #days: number = 0;
  #hours: number = 0;
  #minutes: number = 0;
  #seconds: number = 0;

  constructor(input: string | CqlDurationComponents) {
    if (typeof input === 'string') {
      this.parseFromString(input);
    } else {
      this.#years = input.years || 0;
      this.#months = input.months || 0;
      this.#days = input.days || 0;
      this.#hours = input.hours || 0;
      this.#minutes = input.minutes || 0;
      this.#seconds = input.seconds || 0;
    }
  }

  private parseFromString(input: string): void {
    let isTimeSection = false;
    let currentValue = '';

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (char === 'P') {
        continue;
      }

      if (char === 'T') {
        isTimeSection = true;
        continue;
      }

      if (char >= 'A') {
        const value = +currentValue;
        currentValue = '';

        switch (char) {
          case 'Y':
            this.#years = value;
            break;
          case 'M':
            if (isTimeSection) {
              this.#minutes = value;
            } else {
              this.#months = value;
            }
            break;
          case 'D':
            this.#days = value;
            break;
          case 'H':
            this.#hours = value;
            break;
          case 'S':
            this.#seconds = value;
            break;
          case 'W':
            this.#days += value * 7;
            break;
        }
      } else {
        currentValue += char;
      }
    }
  }

  toDuration(): CqlDurationComponents {
    return {
      years: this.#years,
      months: this.#months,
      days: this.#days,
      hours: this.#hours,
      minutes: this.#minutes,
      seconds: this.#seconds,
    };
  }
}

export interface CqlTimeComponents {
  hours: number,
  minutes: number,
  seconds: number,
  milliseconds?: number
}

export class CqlTime {
  readonly #hours: number;
  readonly #minutes: number;
  readonly #seconds: number;
  readonly #milliseconds: number;

  constructor(input: string | Date | CqlTimeComponents) {
    if (typeof input === 'string') {
      const [timePart, fractionPart] = input.split('.');
      const [hours, mins, secs] = timePart.split(':');

      this.#hours = +hours;
      this.#minutes = +mins;
      this.#seconds = +secs;
      this.#milliseconds = 0;

      if (fractionPart) {
        this.#milliseconds = Math.floor(Number('0.' + fractionPart) * 1000);
      }
    } else if (input instanceof Date) {
      this.#hours = input.getHours();
      this.#minutes = input.getMinutes();
      this.#seconds = input.getSeconds();
      this.#milliseconds = input.getMilliseconds();
    } else {
      this.#hours = input.hours;
      this.#minutes = input.minutes;
      this.#seconds = input.seconds;
      this.#milliseconds = input.milliseconds ?? 0;
    }
  }

  toDate(): Date {
    const now = new Date();
    now.setHours(this.#hours, this.#minutes, this.#seconds, this.#milliseconds);
    return now;
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
  readonly #date: Date;

  constructor(input: string | Date | CqlTimestampComponents) {
    if (typeof input === 'string' || input instanceof Date) {
      this.#date = new Date(input);
    } else {
      this.#date = new Date(input.year, input.month - 1, input.date, input.hours, input.minutes, input.seconds, input.ms);
    }
  }

  toDate(): Date {
    return new Date(this.#date);
  }
}
