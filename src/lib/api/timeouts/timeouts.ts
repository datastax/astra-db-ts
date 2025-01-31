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
import { p, Parser } from '@/src/lib/validation';
import { ParsedTimeoutDescriptor, TimeoutCfgHandler } from '@/src/lib/api/timeouts/cfg-handler';

/**
 * The timeout categories that caused the timeout.
 *
 * If the timeout was caused by:
 * - a single timeout category, the category name is returned.
 * - multiple categories, an array of category names is returned.
 * - a plain-number-timeout provided by the user in a single-call method, the string `'provided'` is returned.
 *
 * @public
 */
export type TimedOutCategories = OneOrMany<keyof TimeoutDescriptor> | 'provided';

/**
 * #### Overview
 *
 * The generic timeout descriptor that is used to define the timeout for all the various operations supported by
 * the {@link DataAPIClient} and its children.
 *
 * ###### Inheritance
 *
 * The {@link TimeoutDescriptor}, or a subset of it, may be specified at any level of the client hierarchy, all the
 * way from the {@link DataAPIClient} down to the individual methods. The timeout specified at a lower level will
 * override the timeout specified at a higher level (through a typical object merge).
 *
 * @example
 * ```ts
 * // The request timeout for all operations is set to 1000ms.
 * const client = new DataAPIClient('...', {
 *   timeoutDefaults: { requestTimeoutMs: 1000 },
 * });
 *
 * // The request timeout for all operations borne from this Db is set to 2000ms.
 * const db = client.db('...', {
 *   timeoutDefaults: { requestTimeoutMs: 2000 },
 * });
 * ```
 *
 * ###### The `WithTimeout` interface
 *
 * The {@link WithTimeout} interface lets you specify timeouts for individual methods, in two different formats:
 * - A subtype of {@link TimeoutDescriptor}, which lets you specify the timeout for specific categories.
 * - A number, which specifies the "happy path" timeout for the method.
 *   - In single-call methods, this sets both the request & overall method timeouts.
 *   - In multi-call methods, this sets the overall method timeout (request timeouts are kept as default).
 *
 * @example
 * ```ts
 * // Both `requestTimeoutMs` and `generalMethodTimeoutMs` are set to 1000ms.
 * await coll.insertOne({ ... }, { timeout: 1000 });
 *
 * // `requestTimeoutMs` is left as default, `generalMethodTimeoutMs` is set to 2000ms.
 * await coll.insertOne({ ... }, { timeout: { generalMethodTimeoutMs: 2000 } });
 *
 * // Both `requestTimeoutMs` and `generalMethodTimeoutMs` are set to 2000ms.
 * await coll.insertMany([...], {
 *   timeout: { requestTimeoutMs: 2000, generalMethodTimeoutMs: 2000 },
 * });
 * ```
 *
 * @example
 * ```ts
 * // `requestTimeoutMs` is left as default, `generalMethodTimeoutMs` is set to 2000ms.
 * await coll.insertMany([...], { timeout: 2000 });
 *
 * // `requestTimeoutMs` is left as default, `generalMethodTimeoutMs` is set to 2000ms.
 * await coll.insertMany([...], { timeout: { generalMethodTimeoutMs: 2000 } });
 *
 * // Both `requestTimeoutMs` and `generalMethodTimeoutMs` are set to 2000ms.
 * await coll.insertMany([...], {
 *   timeout: { requestTimeoutMs: 2000, generalMethodTimeoutMs: 2000 },
 * });
 * ```
 *
 * #### Timeout types
 *
 * There are 6 generalized categories of timeouts, each with its own default values.
 *
 * In general though, two types of timeouts are always in play:
 * - `requestTimeoutMs`, which is the maximum time the client will wait for a response from the server.
 * - The overall method timeout, which is the maximum time the client will wait for the entire method to complete.
 *
 * Timeout behavior depends on the type of method being called:
 * - In single-call methods, the minimum of these two values is used as the timeout.
 * - In multi-call methods, the `requestTimeoutMs` is used as the timeout for each individual call, and the overall method timeout is used as the timeout for the entire method.
 *
 * This two-part timeout system is used in all methods but, but for a special few, where the overall method timeout is the only one used (only `createCollection`, at the moment). This is because the method is a single call, but it takes a long time for the server to complete.
 *
 * If any timeout is set to `0`, that category is effectively disabled.
 *
 * ###### Timeout categories
 *
 * See each individual field for more information, but in general, the timeouts are as follows:
 * - `requestTimeoutMs`:
 *   - The maximum time the client will wait for a response from the server.
 *   - Default: 10 seconds
 * - `generalMethodTimeoutMs`:
 *   - The overall method timeout for methods that don't have a specific overall method timeout.
 *   - (mostly applies to document/row-level operations)
 *   - Default: 30 seconds
 * - `collectionAdminTimeoutMs`:
 *   - The overall method timeout for collection admin operations.
 *   - (create, drop, list, etc.)
 *   - Default: 1 minute
 * - `tableAdminTimeoutMs`:
 *   - The overall method timeout for table admin operations.
 *   - (create, drop, list, alter, create/dropIndex, etc.)
 *   - Default: 30 seconds
 * - `databaseAdminTimeoutMs`:
 *   - The overall method timeout for database admin operations.
 *   - (create, drop, list, info, findEmbeddingProviders, etc.)
 *   - Default: 10 minutes
 * - `keyspaceAdminTimeoutMs`:
 *   - The overall method timeout for keyspace admin operations.
 *   - (create, drop, list)
 *   - Default: 30 seconds
 *
 * @see WithTimeout
 *
 * @public
 */
export interface TimeoutDescriptor {
  /**
   * The maximum time the client will wait for a response from the server.
   *
   * Note that it is technically possible for a request to time out, but still have the request be processed, and even succeed, on the server.
   *
   * Every HTTP call will use a `requestTimeout`, except for very special cases (at the moment, only `createCollection`, where the request may take a long time to return).
   *
   * Default: 10 seconds
   */
  requestTimeoutMs: number,
  /**
   * The overall method timeout for methods that don't have a specific overall method timeout.
   *
   * Mostly applies to document/row-level operations. DDL-esque operations (working with collections, tables, databases, keyspaces, indexes, etc.) have their own overall method timeouts.
   *
   * In single-call methods, such as `insertOne`, the minimum of `requestTimeoutMs` and `generalMethodTimeoutMs` is used as the timeout.
   *
   * In multi-call methods, such as `insertMany`, the `requestTimeoutMs` is used as the timeout for each individual call, and the `generalMethodTimeoutMs` is used as the timeout for the entire method.
   *
   * Default: 30 seconds
   */
  generalMethodTimeoutMs: number,
  /**
   * The overall method timeout for collection admin operations.
   *
   * Such methods include (but may not be limited to):
   * - `db.createCollection()`
   * - `db.dropCollection()`
   * - `db.listCollections()`
   * - `collection.options()`
   *
   * Default: 1 minute
   */
  collectionAdminTimeoutMs: number,
  /**
   * The overall method timeout for table admin operations.
   *
   * Such methods include (but may not be limited to):
   * - `db.createTable()`
   * - `db.dropTable()`
   * - `db.listTables()`
   * - `table.alter()`
   * - `table.createIndex()`
   * - `db.dropTableIndex()`
   * - `table.definition()`
   *
   *
   * Default: 30 seconds
   */
  tableAdminTimeoutMs: number,
  /**
   * The overall method timeout for database admin operations.
   *
   * Such methods include (but may not be limited to):
   * - `admin.createDatabase()`
   * - `admin.dropDatabase()`
   * - `admin.listDatabases()`
   * - `dbAdmin.info()`
   * - `dbAdmin.findEmbeddingProviders()`
   *
   * Default: 10 minutes
   */
  databaseAdminTimeoutMs: number,
  /**
   * The overall method timeout for keyspace admin operations.
   *
   * Such methods include (but may not be limited to):
   * - `admin.createKeyspace()`
   * - `admin.dropKeyspace()`
   * - `admin.listKeyspaces()`
   *
   * Default: 30 seconds
   */
  keyspaceAdminTimeoutMs: number,
}

/**
 * ##### Overview
 *
 * Lets you specify timeouts for individual methods, in two different formats:
 * - A subtype of {@link TimeoutDescriptor}, which lets you specify the timeout for specific categories.
 * - A number, which specifies the "happy path" timeout for the method.
 *   - In single-call methods, this sets both the request & overall method timeouts.
 *   - In multi-call methods, this sets the overall method timeout (request timeouts are kept as default).
 *
 * @example
 * ```ts
 * // Both `requestTimeoutMs` and `generalMethodTimeoutMs` are set to 1000ms.
 * await coll.insertOne({ ... }, { timeout: 1000 });
 *
 * // `requestTimeoutMs` is left as default, `generalMethodTimeoutMs` is set to 2000ms.
 * await coll.insertOne({ ... }, { timeout: { generalMethodTimeoutMs: 2000 } });
 *
 * // Both `requestTimeoutMs` and `generalMethodTimeoutMs` are set to 2000ms.
 * await coll.insertMany([...], {
 *   timeout: { requestTimeoutMs: 2000, generalMethodTimeoutMs: 2000 },
 * });
 * ```
 *
 * @example
 * ```ts
 * // `requestTimeoutMs` is left as default, `generalMethodTimeoutMs` is set to 2000ms.
 * await coll.insertMany([...], { timeout: 2000 });
 *
 * // `requestTimeoutMs` is left as default, `generalMethodTimeoutMs` is set to 2000ms.
 * await coll.insertMany([...], { timeout: { generalMethodTimeoutMs: 2000 } });
 *
 * // Both `requestTimeoutMs` and `generalMethodTimeoutMs` are set to 2000ms.
 * await coll.insertMany([...], {
 *   timeout: { requestTimeoutMs: 2000, generalMethodTimeoutMs: 2000 },
 * });
 * ```
 *
 * See {@link TimeoutDescriptor} for much more information.
 *
 * @see TimeoutDescriptor
 *
 * @public
 */
export interface WithTimeout<Timeouts extends keyof TimeoutDescriptor> {
  /**
   * The method timeout override.
   *
   * See {@link TimeoutDescriptor} for much more information.
   */
  timeout?: number | Pick<Partial<TimeoutDescriptor>, 'requestTimeoutMs' | Timeouts>;
}

/**
 * @internal
 */
export type MkTimeoutError = (info: HTTPRequestInfo, timeoutType: TimedOutCategories) => Error;

/**
 * @internal
 */
export interface TimeoutManager {
  initial(): Partial<TimeoutDescriptor>,
  advance(info: HTTPRequestInfo): [number, () => Error],
}

/**
 * @internal
 */
export const EffectivelyInfinity = 2 ** 31 - 1;

/**
 * @internal
 */
export class Timeouts {
  public static cfg: typeof TimeoutCfgHandler = TimeoutCfgHandler;

  public static Default = Timeouts.cfg.parse({
    requestTimeoutMs: 10000,
    generalMethodTimeoutMs: 30000,
    collectionAdminTimeoutMs: 60000,
    tableAdminTimeoutMs: 30000,
    databaseAdminTimeoutMs: 600000,
    keyspaceAdminTimeoutMs: 30000,
  });

  public readonly baseTimeouts: TimeoutDescriptor;

  constructor(private readonly _mkTimeoutError: MkTimeoutError, baseTimeouts: ParsedTimeoutDescriptor) {
    this.baseTimeouts = TimeoutCfgHandler.concat(Timeouts.Default, baseTimeouts) as TimeoutDescriptor;
  }

  public single(key: Exclude<keyof TimeoutDescriptor, 'requestTimeoutMs'>, override: WithTimeout<any> | nullish): TimeoutManager {
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

  public multipart(key: Exclude<keyof TimeoutDescriptor, 'requestTimeoutMs'>, override: WithTimeout<any> | nullish): TimeoutManager {
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

  public custom(peek: Partial<TimeoutDescriptor>, advance: () => [number, TimedOutCategories]): TimeoutManager {
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

  public static merge(base: Partial<TimeoutDescriptor>, custom: Partial<TimeoutDescriptor> | nullish): Partial<TimeoutDescriptor> {
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

  public static fmtTimeoutMsg = (tm: TimeoutManager, timeoutTypes: TimedOutCategories) => {
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

  public static parseConfig: Parser<Partial<TimeoutDescriptor> | undefined> = (raw, field) => {
    const opts = p.parse('object?')<TimeoutDescriptor>(raw, field);

    if (!opts) {
      return undefined;
    }

    return {
      requestTimeoutMs: p.parse('number?')(opts.requestTimeoutMs, `${field}.requestTimeoutMs`),
      generalMethodTimeoutMs: p.parse('number?')(opts.generalMethodTimeoutMs, `${field}.generalMethodTimeoutMs`),
      collectionAdminTimeoutMs: p.parse('number?')(opts.collectionAdminTimeoutMs, `${field}.collectionAdminTimeoutMs`),
      tableAdminTimeoutMs: p.parse('number?')(opts.tableAdminTimeoutMs, `${field}.tableAdminTimeoutMs`),
      databaseAdminTimeoutMs: p.parse('number?')(opts.databaseAdminTimeoutMs, `${field}.databaseAdminTimeoutMs`),
      keyspaceAdminTimeoutMs: p.parse('number?')(opts.keyspaceAdminTimeoutMs, `${field}.keyspaceAdminTimeoutMs`),
    };
  };
}
