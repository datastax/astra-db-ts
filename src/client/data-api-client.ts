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
// noinspection JSDeprecatedSymbols

import { Db, mkDb, validateDbOpts } from '@/src/data-api/db';
import { AstraAdmin, mkAdmin, validateAdminOpts } from '@/src/devops/astra-admin';
import {
  Caller,
  CustomHttpClientOptions,
  DataAPIClientOptions,
  DataAPIHttpOptions, DefaultHttpClientOptions,
  InternalRootClientOpts,
} from '@/src/client/types';
import TypedEmitter from 'typed-emitter';
import { DataAPICommandEvents } from '@/src/data-api/events';
import { AdminCommandEvents, AdminSpawnOptions } from '@/src/devops';
import { validateOption } from '@/src/data-api/utils';
import { buildUserAgent, FetchCtx, FetchH2 } from '@/src/api';
import { FetchNative } from '@/src/api/fetch/fetch-native';
import { LIB_NAME } from '@/src/version';
import { Fetcher } from '@/src/api/fetch/types';
import { DbSpawnOptions } from '@/src/data-api';
import { nullish, TokenProvider } from '@/src/common';

/**
 * The events emitted by the {@link DataAPIClient}. These events are emitted at various stages of the
 * command's lifecycle. Intended for use for monitoring and logging purposes.
 *
 * Events include:
 * - `commandStarted` - Emitted when a command is started, before the initial HTTP request is made.
 * - `commandSucceeded` - Emitted when a command has succeeded.
 * - `commandFailed` - Emitted when a command has errored.
 * - `adminCommandStarted` - Emitted when an admin command is started, before the initial HTTP request is made.
 * - `adminCommandPolling` - Emitted when a command is polling in a long-running operation (i.e. create database).
 * - `adminCommandSucceeded` - Emitted when an admin command has succeeded, after any necessary polling.
 * - `adminCommandFailed` - Emitted when an admin command has errored.
 *
 * @public
 */
export type DataAPIClientEvents =
  & DataAPICommandEvents
  & AdminCommandEvents

/**
 * The base class for the {@link DataAPIClient} event emitter to make it properly typed.
 *
 * Should probably never need to be used directly.
 *
 * @public
 */
export const DataAPIClientEventEmitterBase = (() => {
  try {
    return (require('events') as { EventEmitter: (new () => TypedEmitter<DataAPIClientEvents>) }).EventEmitter;
  } catch (e) {
    throw new Error(`\`${LIB_NAME}\` requires the \`events\` module to be available for usage. Please provide a polyfill (e.g. the \`events\` package) or use a compatible environment.`);
  }
})();

/**
 * The main entrypoint into working with the Data API. It sits at the top of the
 * [conceptual hierarchy](https://github.com/datastax/astra-db-ts/tree/signature-cleanup?tab=readme-ov-file#abstraction-diagram)
 * of the SDK.
 *
 * The client takes in a default token, which can be overridden by a stronger/weaker token when spawning a new
 * {@link Db} or {@link AstraAdmin} instance.
 *
 * It also takes in a set of default options (see {@link DataAPIClientOptions}) that may also be overridden as necessary.
 *
 * @example
 * ```typescript
 * const client = new DataAPIClient('AstraCS:...');
 *
 * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
 * const db2 = client.db('my-database', 'us-east1');
 *
 * const coll = await db1.collection('my-collection');
 *
 * const admin1 = client.admin();
 * const admin2 = client.admin({ adminToken: '<stronger_token>' });
 *
 * console.log(await coll.insertOne({ name: 'Lordi' }));
 * console.log(await admin1.listDatabases());
 * ```
 *
 * @public
 */
export class DataAPIClient extends DataAPIClientEventEmitterBase {
  readonly #options: InternalRootClientOpts;

  /**
   * Constructs a new instance of the {@link DataAPIClient}.
   *
   * @param options - The default options to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
   */
  constructor(options?: DataAPIClientOptions | nullish)

  /**
   * Constructs a new instance of the {@link DataAPIClient}.
   *
   * @param token - The default token to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
   * @param options - The default options to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
   */
  constructor(token: string | TokenProvider | nullish, options?: DataAPIClientOptions | nullish)

  constructor(tokenOrOptions?: string | TokenProvider | DataAPIClientOptions | null, maybeOptions?: DataAPIClientOptions | null) {
    super();

    const tokenPassed = (typeof tokenOrOptions === 'string' || tokenOrOptions instanceof TokenProvider || maybeOptions !== undefined);

    const token = (tokenPassed)
      ? tokenOrOptions
      : undefined;

    const options = (tokenPassed)
      ? maybeOptions
      : tokenOrOptions;

    validateRootOpts(options);

    const dbToken = TokenProvider.parseToken(options?.dbOptions?.token ?? token);
    const adminToken = TokenProvider.parseToken(options?.adminOptions?.adminToken ?? token);

    this.#options = {
      ...options,
      fetchCtx: buildFetchCtx(options || undefined),
      dbOptions: {
        monitorCommands: false,
        ...options?.dbOptions,
        token: dbToken,
      },
      adminOptions: {
        monitorCommands: false,
        ...options?.adminOptions,
        adminToken: adminToken,
      },
      emitter: this,
      userAgent: buildUserAgent(options?.caller),
    };

    if (Symbol.asyncDispose) {
      this[Symbol.asyncDispose] = () => this.close();
    }
  }

  /**
   * Spawns a new {@link Db} instance using a direct endpoint and given options.
   *
   * **NB. This method does not validate the existence of the database—it simply creates a reference.**
   *
   * This endpoint should include the protocol and the hostname, but not the path. It's typically in the form of
   * `https://<db_id>-<region>.apps.astra.datastax.com`, but it can be used with DSE or any other Data-API-compatible
   * endpoint.
   *
   * The given options will override any default options set when creating the {@link DataAPIClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
   *
   * @example
   * ```typescript
   * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
   *
   * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
   *   namespace: 'my-namespace',
   *   useHttp2: false,
   * });
   * ```
   *
   * @remarks
   * Note that this does not perform any IO or validation on if the endpoint is valid or not. It's up to the user to
   * ensure that the endpoint is correct. If you want to create an actual database, see {@link AstraAdmin.createDatabase}
   * instead.
   *
   * @param endpoint - The direct endpoint to use.
   * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
   *
   * @returns A new {@link Db} instance.
   */
  public db(endpoint: string, options?: DbSpawnOptions): Db;

  /**
   * Spawns a new {@link Db} instance using a direct endpoint and given options.
   *
   * **NB. This method does not validate the existence of the database—it simply creates a reference.**
   *
   * This overload is purely for user convenience, but it **only supports using Astra as the underlying database**. For
   * DSE or any other Data-API-compatible endpoint, use the other overload instead.
   *
   * The given options will override any default options set when creating the {@link DataAPIClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
   *
   * @example
   * ```typescript
   * const db1 = client.db('a6a1d8d6-31bc-4af8-be57-377566f345bf', 'us-east1');
   *
   * const db2 = client.db('a6a1d8d6-31bc-4af8-be57-377566f345bf', 'us-east1', {
   *   namespace: 'my-namespace',
   *   useHttp2: false,
   * });
   * ```
   *
   * @remarks
   * Note that this does not perform any IO or validation on if the endpoint is valid or not. It's up to the user to
   * ensure that the endpoint is correct. If you want to create an actual database, see {@link AstraAdmin.createDatabase}
   * instead.
   *
   * @param id - The database ID to use.
   * @param region - The region to use.
   * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
   *
   * @returns A new {@link Db} instance.
   */
  public db(id: string, region: string, options?: DbSpawnOptions): Db;

  public db(endpointOrId: string, regionOrOptions?: string | DbSpawnOptions, maybeOptions?: DbSpawnOptions): Db {
    return mkDb(this.#options, endpointOrId, regionOrOptions, maybeOptions);
  }

  /**
   * Spawns a new {@link AstraAdmin} instance using the given options to work with the DevOps API (for admin
   * work such as creating/managing databases).
   *
   * **NB. This method is only available for Astra databases.**
   *
   * The given options will override any default options set when creating the {@link DataAPIClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
   *
   * @example
   * ```typescript
   * const admin1 = client.admin();
   * const admin2 = client.admin({ adminToken: '<stronger_token>' });
   *
   * const dbs = await admin1.listDatabases();
   * console.log(dbs);
   * ```
   *
   * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
   *
   * @returns A new {@link AstraAdmin} instance.
   */
  public admin(options?: AdminSpawnOptions): AstraAdmin {
    return mkAdmin(this.#options, options);
  }

  /**
   * Closes the client and disconnects all underlying connections. This should be called when the client is no longer
   * needed to free up resources.
   *
   * The client will be no longer usable after this method is called.
   *
   * @remarks
   * This method is idempotent and can be called multiple times without issue.
   *
   * --
   *
   * For most users, this method isn't necessary to call, as resources will be freed up when the
   * server is shut down or the process is killed. However, it's useful in long-running processes or when you want to
   * free up resources immediately.
   *
   * --
   *
   * Think of it as using malloc or using a file descriptor. Freeing them isn't always strictly necessary for
   * long-running usages, but it's there for when you need it.
   *
   * @returns A promise that resolves when the client has been closed.
   */
  public async close(): Promise<void> {
    await this.#options.fetchCtx.ctx.close?.();
    this.#options.fetchCtx.closed.ref = true;
  }

  /**
   * Allows for the `await using` syntax (if your typescript version \>= 5.2) to automatically close the client when
   * it's out of scope.
   *
   * Equivalent to wrapping the client usage in a `try`/`finally` block and calling `client.close()` in the `finally`
   * block.
   *
   * @example
   * ```typescript
   * async function main() {
   *   // Will unconditionally close the client when the function exits
   *   await using client = new DataAPIClient('*TOKEN*');
   *
   *   // Using the client as normal
   *   const db = client.db('*ENDPOINT*');
   *   console.log(await db.listCollections());
   *
   *   // Or pass it to another function to run your app
   *   app(client);
   * }
   * main();
   * ```
   *
   * *This will only be defined if the `Symbol.asyncDispose` symbol is actually defined.*
   */
  public [Symbol.asyncDispose]!: () => Promise<void>;
}

function buildFetchCtx(options: DataAPIClientOptions | undefined): FetchCtx {
  const clientType = (options?.httpOptions || getDeprecatedPrefersHttp2(options))
    ? options?.httpOptions?.client ?? 'default'
    : undefined;

  const ctx =
    (clientType === 'fetch')
      ? new FetchNative() :
    (clientType === 'custom')
      ? (options!.httpOptions as CustomHttpClientOptions).fetcher
      : tryLoadFetchH2(clientType, options)

  return {
    ctx: ctx,
    closed: { ref: false },
    maxTimeMS: options?.httpOptions?.maxTimeMS,
  };
}

function tryLoadFetchH2(clientType: string | undefined, options: DataAPIClientOptions | undefined): Fetcher {
  try {
    const httpOptions = options?.httpOptions as DefaultHttpClientOptions | undefined;

    const preferHttp2 = httpOptions?.preferHttp2
      ?? getDeprecatedPrefersHttp2(options)
      ?? true

    return new FetchH2(httpOptions, preferHttp2);
  } catch (e) {
    if (clientType === undefined) {
      return new FetchNative();
    } else {
      throw e;
    }
  }
}

// Shuts the linter up about 'preferHttp2' being deprecated
function getDeprecatedPrefersHttp2(opts: DataAPIClientOptions | undefined | null): boolean | undefined {
  return opts?.[('preferHttp2' as any as null)!];
}

function validateRootOpts(opts: DataAPIClientOptions | undefined | null) {
  validateOption('DataAPIClientOptions', opts, 'object');

  if (!opts) {
    return;
  }

  validateOption('caller', opts.caller, 'object', false, validateCaller);
  validateOption('preferHttp2 option', getDeprecatedPrefersHttp2(opts), 'boolean');

  validateDbOpts(opts.dbOptions);
  validateAdminOpts(opts.adminOptions);
  validateHttpOpts(opts.httpOptions);
}

function validateHttpOpts(opts: DataAPIHttpOptions | undefined | null) {
  validateOption('httpOptions', opts, 'object');

  if (!opts) {
    return;
  }

  validateOption('httpOptions.client', opts.client, 'string', false, (client) => {
    if (!['fetch', 'default', 'custom'].includes(client)) {
      throw new Error('Invalid httpOptions.client; expected \'fetch\', \'default\', \'custom\', or undefined');
    }
  });
  validateOption('httpOptions.maxTimeMS', opts.maxTimeMS, 'number');

  if (opts.client === 'default' || opts.client === undefined) {
    validateOption('httpOptions.preferHttp2', opts.preferHttp2, 'boolean');

    validateOption('httpOptions.http1 options', opts.http1, 'object', false, (http1) => {
      validateOption('http1.keepAlive', http1.keepAlive, 'boolean');
      validateOption('http1.keepAliveMS', http1.keepAliveMS, 'number');
      validateOption('http1.maxSockets', http1.maxSockets, 'number');
      validateOption('http1.maxFreeSockets', http1.maxFreeSockets, 'number');
    });
  }

  if (opts.client === 'custom') {
    validateOption('httpOptions.fetcher option', opts.fetcher, 'object', true, (fetcher) => {
      validateOption('fetcher.fetch option', fetcher.fetch, 'function', true);
      validateOption('fetcher.close option', fetcher.close, 'function');
    });
  }
}

function validateCaller(caller: Caller | Caller[]) {
  if (!Array.isArray(caller)) {
    throw new TypeError('Invalid caller; expected an array, or undefined/null');
  }

  const isCallerArr = Array.isArray(caller[0]);

  const callers = (
    (isCallerArr)
      ?  caller
      : [caller]
  ) as Caller[];

  callers.forEach((c, i) => {
    const idxMessage = (isCallerArr)
      ? ` at index ${i}`
      : '';

    if (!Array.isArray(c)) {
      throw new TypeError(`Invalid caller; expected [name, version?], or an array of such${idxMessage}`);
    }

    if (c.length < 1 || 2 < c.length) {
      throw new Error(`Invalid caller; expected [name, version?], or an array of such${idxMessage}`);
    }

    if (typeof c[0] !== 'string') {
      throw new Error(`Invalid caller; expected a string name${idxMessage}`);
    }

    if (c.length === 2 && typeof c[1] !== 'string') {
      throw new Error(`Invalid caller; expected a string version${idxMessage}`);
    }
  });
}
