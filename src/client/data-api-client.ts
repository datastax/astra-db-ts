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

import { Db, mkDb, validateDbOpts } from '@/src/data-api/db';
import { AstraAdmin, mkAdmin, validateAdminOpts } from '@/src/devops/astra-admin';
import {
  AdminSpawnOptions,
  Caller,
  DbSpawnOptions,
  InternalRootClientOpts,
  DataAPIClientOptions,
} from '@/src/client/types';
import TypedEmitter from 'typed-emitter';
import EventEmitter from 'events';
import { DataAPICommandEvents } from '@/src/data-api/events';
import { AdminCommandEvents } from '@/src/devops';
import { validateOption } from '@/src/data-api/utils';
import { context } from 'fetch-h2';
import { buildUserAgent } from '@/src/api';

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
export const DataAPIClientEventEmitterBase = EventEmitter as (new () => TypedEmitter<DataAPIClientEvents>);

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
   * @param token - The default token to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
   * @param options - The default options to use when spawning new instances of {@link Db} or {@link AstraAdmin}.
   */
  constructor(token: string, options?: DataAPIClientOptions | null) {
    super();

    if (!token || typeof token as any !== 'string') {
      throw new Error('A valid token is required to use the DataAPIClient');
    }

    validateRootOpts(options);

    const baseCtxOptions = {
      userAgent: buildUserAgent(options?.caller),
      overwriteUserAgent: true,
    };

    const http1Ctx = context({
      ...baseCtxOptions,
      httpsProtocols: ['http1'],
    });

    const preferredCtx = (options?.preferHttp2 !== false)
      ? context(baseCtxOptions)
      : http1Ctx;

    this.#options = {
      ...options,
      fetchCtx: {
        http1: http1Ctx,
        preferred: preferredCtx,
        preferredType: (options?.preferHttp2 !== false)
          ? 'http2'
          : 'http1',
        closed: { ref: false },
      },
      dbOptions: {
        monitorCommands: false,
        token: token,
        ...options?.dbOptions,
      },
      adminOptions: {
        monitorCommands: false,
        adminToken: token,
        ...options?.adminOptions,
      },
      emitter: this,
    };
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
    this.#options.fetchCtx.closed.ref = true;
    await this.#options.fetchCtx.preferred.disconnectAll();
    await this.#options.fetchCtx.http1.disconnectAll();
  }
}

function validateRootOpts(opts: DataAPIClientOptions | undefined | null) {
  validateOption('root client options', opts, 'object');

  if (!opts) {
    return;
  }

  validateOption('caller', opts.caller, 'object', validateCaller);

  validateOption('preferHttp2 option', opts.preferHttp2, 'boolean');

  validateDbOpts(opts.dbOptions);

  validateAdminOpts(opts.adminOptions);
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
