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
  requestTimeout: number,
  generalMethodTimeout: number,
  collectionAdminTimeout: number,
  tableAdminTimeout: number,
  databaseAdminTimeout: number,
  keyspaceAdminTimeout: number,
}

export interface WithTimeout<Timeouts extends keyof TimeoutDescriptor = 'generalMethodTimeout' | 'requestTimeout'> {
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

  public single(key: Exclude<keyof TimeoutDescriptor, 'requestTimeout'>, override: WithTimeout<keyof TimeoutDescriptor> | nullish): TimeoutManager {
    if (typeof override?.timeout === 'number') {
      const timeout = override.timeout;

      const initial = {
        requestTimeout: timeout,
        [key]: timeout,
      };

      return this.custom(initial, () => {
        return [timeout, 'provided'];
      });
    }

    const timeouts = {
      requestTimeout: (override?.timeout?.requestTimeout ?? this.baseTimeouts.requestTimeout) || EffectivelyInfinity,
      [key]: (override?.timeout?.[key] ?? this.baseTimeouts[key]) || EffectivelyInfinity,
    };

    const timeout = Math.min(timeouts.requestTimeout, timeouts[key]);

    const type =
      (timeouts.requestTimeout === timeouts[key])
        ? <const>['requestTimeout', key] :
      (timeouts.requestTimeout < timeouts[key])
        ? 'requestTimeout'
        : key;

    return this.custom(timeouts, () => {
      return [timeout, type];
    });
  }

  public multipart(key: Exclude<keyof TimeoutDescriptor, 'requestTimeout'>, override: WithTimeout<keyof TimeoutDescriptor> | nullish): TimeoutManager {
    const requestTimeout = (typeof override?.timeout === 'object')
      ? override.timeout?.requestTimeout ?? this.baseTimeouts.requestTimeout
      : this.baseTimeouts.requestTimeout;

    const overallTimeout =
      (typeof override?.timeout === 'object')
        ? override.timeout?.[key] ?? this.baseTimeouts[key] :
      (typeof override?.timeout === 'number')
        ? override.timeout
        : this.baseTimeouts[key];

    const initial = {
      requestTimeout,
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
        return [requestTimeout, 'requestTimeout'];
      } else {
        return [overallLeft, ['requestTimeout', key]];
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
    requestTimeout: 10000,
    generalMethodTimeout: 30000,
    collectionAdminTimeout: 60000,
    tableAdminTimeout: 30000,
    databaseAdminTimeout: 600000,
    keyspaceAdminTimeout: 30000,
  };

  public static merge(base: TimeoutDescriptor, custom: Partial<TimeoutDescriptor> | nullish): TimeoutDescriptor {
    if (!custom) {
      return base;
    }

    return {
      requestTimeout: custom.requestTimeout ?? base.requestTimeout,
      generalMethodTimeout: custom.generalMethodTimeout ?? base.generalMethodTimeout,
      collectionAdminTimeout: custom.collectionAdminTimeout ?? base.collectionAdminTimeout,
      tableAdminTimeout: custom.tableAdminTimeout ?? base.tableAdminTimeout,
      databaseAdminTimeout: custom.databaseAdminTimeout ?? base.databaseAdminTimeout,
      keyspaceAdminTimeout: custom.keyspaceAdminTimeout ?? base.keyspaceAdminTimeout,
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
