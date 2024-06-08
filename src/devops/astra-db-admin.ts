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
// noinspection ExceptionCaughtLocallyJS

import { AdminBlockingOptions, AdminSpawnOptions, FullDatabaseInfo } from '@/src/devops/types';
import { DEFAULT_DEVOPS_API_ENDPOINT, DevOpsAPIHttpClient, HttpMethods } from '@/src/api';
import { Db } from '@/src/data-api';
import { DbAdmin } from '@/src/devops/db-admin';
import { WithTimeout } from '@/src/common/types';
import { validateAdminOpts } from '@/src/devops/astra-admin';
import { InternalRootClientOpts } from '@/src/client/types';
import { StaticTokenProvider } from '@/src/common';

/**
 * An administrative class for managing Astra databases, including creating, listing, and deleting databases.
 *
 * **Shouldn't be instantiated directly; use {@link DataAPIClient.admin} to obtain an instance of this class.**
 *
 * To perform admin tasks on a per-database basis, see the {@link AstraDbAdmin} class.
 *
 * @example
 * ```typescript
 * const client = new DataAPIClient('token');
 *
 * // Create an admin instance with the default token
 * const admin1 = client.admin();
 *
 * // Create an admin instance with a custom token
 * const admin2 = client.admin({ adminToken: 'stronger-token' });
 *
 * const dbs = await admin1.listDatabases();
 * console.log(dbs);
 * ```
 *
 * @see DataAPIClient.admin
 * @see AstraDbAdmin
 *
 * @public
 */
export class AstraDbAdmin extends DbAdmin {
  private readonly _httpClient!: DevOpsAPIHttpClient;
  private readonly _db!: Db;

  /**
   * Use {@link Db.admin} or {@link AstraAdmin.dbAdmin} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(_db: Db, options: InternalRootClientOpts) {
    super();

    const adminOpts = options.adminOptions;

    Object.defineProperty(this, '_httpClient', {
      value: new DevOpsAPIHttpClient({
        baseUrl: adminOpts.endpointUrl ?? DEFAULT_DEVOPS_API_ENDPOINT,
        applicationToken: adminOpts.adminToken,
        monitorCommands: adminOpts.monitorCommands,
        fetchCtx: options.fetchCtx,
        emitter: options.emitter,
        userAgent: options.userAgent,
      }),
      enumerable: false,
    });

    Object.defineProperty(this, '_db', {
      value: _db,
      enumerable: false,
    });
  }

  /**
   * Gets the ID of the Astra DB instance this object is managing.
   *
   * @returns The ID of the Astra DB instance.
   */
  public get id(): string {
    return this._db.id;
  }

  /**
   * Gets the underlying `Db` object. The options for the db were set when the AstraDbAdmin instance, or whatever
   * spawned it, was created.
   *
   * @example
   * ```typescript
   * const dbAdmin = client.admin().dbAdmin('<endpoint>', {
   *   namespace: 'my-namespace',
   *   useHttp2: false,
   * });
   *
   * const db = dbAdmin.db();
   * console.log(db.id);
   * ```
   *
   * @returns The underlying `Db` object.
   */
  public override db(): Db {
    return this._db;
  }

  /**
   * Fetches the complete information about the database, such as the database name, IDs, region, status, actions, and
   * other metadata.
   *
   * The method issues a request to the DevOps API each time it is invoked, without caching mechanisms;
   * this ensures up-to-date information for usages such as real-time collection validation by the application.
   *
   * @example
   * ```typescript
   * const info = await dbAdmin.info();
   * console.log(info.info.name, info.creationTime);
   * ```
   *
   * @returns A promise that resolves to the complete database information.
   */
  public async info(options?: WithTimeout): Promise<FullDatabaseInfo> {
    const resp = await this._httpClient.request({
      method: HttpMethods.Get,
      path: `/databases/${this._db.id}`,
    }, options);

    return resp.data as FullDatabaseInfo;
  }

  /**
   * Lists the namespaces in the database.
   *
   * The first element in the returned array is the default namespace of the database, and the rest are additional
   * namespaces in no particular order.
   *
   * @example
   * ```typescript
   * const namespaces = await dbAdmin.listNamespaces();
   *
   * // ['default_keyspace', 'my_other_keyspace']
   * console.log(namespaces);
   * ```
   *
   * @returns A promise that resolves to list of all the namespaces in the database.
   */
  public override async listNamespaces(options?: WithTimeout): Promise<string[]> {
    return this.info(options).then(i => [i.info.keyspace!, ...i.info.additionalKeyspaces ?? []].filter(Boolean))
  }

  /**
   * Creates a new, additional, namespace (aka keyspace) for this database.
   *
   * **NB. this is a "long-running" operation. See {@link AdminBlockingOptions} about such blocking operations.** The
   * default polling interval is 1 second. Expect it to take roughly 8-10 seconds to complete.
   *
   * @example
   * ```typescript
   * await dbAdmin.createNamespace('my_other_keyspace1');
   *
   * // ['default_keyspace', 'my_other_keyspace1']
   * console.log(await dbAdmin.listNamespaces());
   *
   * await dbAdmin.createNamespace('my_other_keyspace2', {
   *   blocking: false,
   * });
   *
   * // Will not include 'my_other_keyspace2' until the operation completes
   * console.log(await dbAdmin.listNamespaces());
   * ```
   *
   * @remarks
   * Note that if you choose not to block, the created namespace will not be able to be used until the
   * operation completes, which is up to the caller to determine.
   *
   * @param namespace - The name of the new namespace.
   * @param options - The options for the blocking behavior of the operation.
   *
   * @returns A promise that resolves when the operation completes.
   */
  public override async createNamespace(namespace: string, options?: AdminBlockingOptions): Promise<void> {
    await this._httpClient.requestLongRunning({
      method: HttpMethods.Post,
      path: `/databases/${this._db.id}/keyspaces/${namespace}`,
    }, {
      id: this._db.id,
      target: 'ACTIVE',
      legalStates: ['MAINTENANCE'],
      defaultPollInterval: 1000,
      options,
    });
  }

  /**
   * Drops a namespace (aka keyspace) from this database.
   *
   * **NB. this is a "long-running" operation. See {@link AdminBlockingOptions} about such blocking operations.** The
   * default polling interval is 1 second. Expect it to take roughly 8-10 seconds to complete.
   *
   * @example
   * ```typescript
   * await dbAdmin.dropNamespace('my_other_keyspace1');
   *
   * // ['default_keyspace', 'my_other_keyspace2']
   * console.log(await dbAdmin.listNamespaces());
   *
   * await dbAdmin.dropNamespace('my_other_keyspace2', {
   *   blocking: false,
   * });
   *
   * // Will still include 'my_other_keyspace2' until the operation completes
   * // ['default_keyspace', 'my_other_keyspace2']
   * console.log(await dbAdmin.listNamespaces());
   * ```
   *
   * @remarks
   * Note that if you choose not to block, the namespace will still be able to be used until the operation
   * completes, which is up to the caller to determine.
   *
   * @param namespace - The name of the namespace to drop.
   * @param options - The options for the blocking behavior of the operation.
   *
   * @returns A promise that resolves when the operation completes.
   */
  public override async dropNamespace(namespace: string, options?: AdminBlockingOptions): Promise<void> {
    await this._httpClient.requestLongRunning({
      method: HttpMethods.Delete,
      path: `/databases/${this._db.id}/keyspaces/${namespace}`,
    }, {
      id: this._db.id,
      target: 'ACTIVE',
      legalStates: ['MAINTENANCE'],
      defaultPollInterval: 1000,
      options,
    });
  }

  /**
   * Drops the database.
   *
   * **NB. this is a long-running operation. See {@link AdminBlockingOptions} about such blocking operations.** The
   * default polling interval is 10 seconds. Expect it to take roughly 6-7 min to complete.
   *
   * The database info will still be accessible by ID, or by using the {@link AstraAdmin.listDatabases} method with the filter
   * set to `'ALL'` or `'TERMINATED'`. However, all of its data will very much be lost.
   *
   * @example
   * ```typescript
   * const db = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
   * await db.admin().drop();
   * ```
   *
   * @param options - The options for the blocking behavior of the operation.
   *
   * @returns A promise that resolves when the operation completes.
   *
   * @remarks Use with caution. Use a surge protector. Don't say I didn't warn you.
   */
  public async drop(options?: AdminBlockingOptions): Promise<void> {
    await this._httpClient.requestLongRunning({
      method: HttpMethods.Post,
      path: `/databases/${this._db.id}/terminate`,
    }, {
      id: this._db.id,
      target: 'TERMINATED',
      legalStates: ['TERMINATING'],
      defaultPollInterval: 10000,
      options,
    });
  }
}

/**
 * @internal
 */
export function mkDbAdmin(db: Db, rootOpts: InternalRootClientOpts, options?: AdminSpawnOptions): AstraDbAdmin {
  validateAdminOpts(options);

  return new AstraDbAdmin(db, {
    ...rootOpts,
    adminOptions: {
      ...rootOpts.adminOptions,
      ...options,
      adminToken: StaticTokenProvider.fromMaybeString(options?.adminToken ?? rootOpts?.adminOptions?.adminToken),
    },
  });
}
