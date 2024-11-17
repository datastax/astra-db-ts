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

import { nullish, OneOrMany } from '@/src/lib';
import { HTTPRequestInfo } from '@/src/lib/api/clients';
import { toArray } from '@/src/lib/utils';

export type TimedOutTypes = OneOrMany<keyof TimeoutDescriptor> | 'provided';

export interface TimeoutDescriptor {
  requestTimeoutMs: number,
  generalMethodTimeoutMs: number,
  collectionAdminTimeoutMs: number,
  tableAdminTimeoutMs: number,
  databaseAdminTimeoutMs: number,
  keyspaceAdminTimeoutMs: number,
}

export interface WithTimeout<Timeouts extends keyof TimeoutDescriptor = 'generalMethodTimeoutMs' | 'requestTimeoutMs'> {
  timeout?: number | Pick<Partial<TimeoutDescriptor>, Timeouts>;
}

export type MkTimeoutError = (info: HTTPRequestInfo, timeoutType: TimedOutTypes) => Error;

export interface TimeoutManager {
  initial(): Partial<TimeoutDescriptor>,
  advance(info: HTTPRequestInfo): [number, () => Error],
}

export const EffectivelyInfinity = 2 ** 31 - 1;

export class Timeouts {
  constructor(
    private readonly _mkTimeoutError: MkTimeoutError,
    public readonly baseTimeouts: TimeoutDescriptor,
  ) {}

  public single(key: Exclude<keyof TimeoutDescriptor, 'requestTimeoutMs'>, override: WithTimeout<keyof TimeoutDescriptor> | nullish): TimeoutManager {
    if (typeof override?.timeout === 'number') {
      const timeout = override.timeout;

      const initial = {
        requestTimeoutMs: timeout,
        [key]: timeout,
      };

      return this.custom(initial, () => {
        return [timeout, 'provided'];
      });
    }

    const timeouts = {
      requestTimeoutMs: (override?.timeout?.requestTimeoutMs ?? this.baseTimeouts.requestTimeoutMs) || EffectivelyInfinity,
      [key]: (override?.timeout?.[key] ?? this.baseTimeouts[key]) || EffectivelyInfinity,
    };

    const timeout = Math.min(timeouts.requestTimeoutMs, timeouts[key]);

    const type =
      (timeouts.requestTimeoutMs === timeouts[key])
        ? <const>['requestTimeoutMs', key] :
      (timeouts.requestTimeoutMs < timeouts[key])
        ? 'requestTimeoutMs'
        : key;

    return this.custom(timeouts, () => {
      return [timeout, type];
    });
  }

  public multipart(key: Exclude<keyof TimeoutDescriptor, 'requestTimeoutMs'>, override: WithTimeout<keyof TimeoutDescriptor> | nullish): TimeoutManager {
    const requestTimeout = ((typeof override?.timeout === 'object')
      ? override.timeout?.requestTimeoutMs ?? this.baseTimeouts.requestTimeoutMs
      : this.baseTimeouts.requestTimeoutMs)
        || EffectivelyInfinity;

    const overallTimeout =
      ((typeof override?.timeout === 'object')
        ? override.timeout?.[key] ?? this.baseTimeouts[key] :
      (typeof override?.timeout === 'number')
        ? override.timeout
        : this.baseTimeouts[key])
          || EffectivelyInfinity;

    const initial = {
      requestTimeoutMs: requestTimeout,
      [key]: overallTimeout,
    };

    let started: number;

    return this.custom(initial, () => {
      if (!started) {
        started = Date.now();
      }

      const overallLeft = overallTimeout - (Date.now() - started);

      if (overallLeft < requestTimeout) {
        return [overallLeft, key];
      } else if (overallLeft > requestTimeout) {
        return [requestTimeout, 'requestTimeoutMs'];
      } else {
        return [overallLeft, ['requestTimeoutMs', key]];
      }
    });
  }

  public custom(peek: Partial<TimeoutDescriptor>, advance: () => [number, TimedOutTypes]): TimeoutManager {
    return {
      initial() {
        return peek;
      },
      advance: (info) => {
        const advanced = advance() as any;
        const timeoutType = advanced[1];
        advanced[1] = () => this._mkTimeoutError(info, timeoutType);
        return advanced;
      },
    };
  }

  public static Default: TimeoutDescriptor = {
    requestTimeoutMs: 10000,
    generalMethodTimeoutMs: 30000,
    collectionAdminTimeoutMs: 60000,
    tableAdminTimeoutMs: 30000,
    databaseAdminTimeoutMs: 600000,
    keyspaceAdminTimeoutMs: 30000,
  };

  public static merge(base: TimeoutDescriptor, custom: Partial<TimeoutDescriptor> | nullish): TimeoutDescriptor {
    if (!custom) {
      return base;
    }

    return {
      requestTimeoutMs: custom.requestTimeoutMs ?? base.requestTimeoutMs,
      generalMethodTimeoutMs: custom.generalMethodTimeoutMs ?? base.generalMethodTimeoutMs,
      collectionAdminTimeoutMs: custom.collectionAdminTimeoutMs ?? base.collectionAdminTimeoutMs,
      tableAdminTimeoutMs: custom.tableAdminTimeoutMs ?? base.tableAdminTimeoutMs,
      databaseAdminTimeoutMs: custom.databaseAdminTimeoutMs ?? base.databaseAdminTimeoutMs,
      keyspaceAdminTimeoutMs: custom.keyspaceAdminTimeoutMs ?? base.keyspaceAdminTimeoutMs,
    };
  }

  public static fmtTimeoutMsg = (tm: TimeoutManager, timeoutTypes: TimedOutTypes) => {
    const timeout = (timeoutTypes === 'provided')
      ? Object.values(tm.initial())[0]!
      : tm.initial()[toArray(timeoutTypes)[0]];

    const types =
      (timeoutTypes === 'provided')
        ? `The timeout provided via \`{ timeout: <number> }\` timed out` :
      (Array.isArray(timeoutTypes))
        ? timeoutTypes.join(' and ') + ' simultaneously timed out'
        : `${timeoutTypes} timed out`;

    return `Command timed out after ${timeout}ms (${types})`;
  };
}
