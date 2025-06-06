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

import type { CreateAstraKeyspaceOptions, DropAstraKeyspaceOptions } from '@/src/administration/types/index.js';
import { DbAdmin } from '@/src/administration/db-admin.js';
import type { OpaqueHttpClient, CommandOptions } from '@/src/lib/index.js';
import { TokenProvider } from '@/src/lib/index.js';
import { buildAstraDatabaseAdminInfo, extractAstraEnvironment } from '@/src/administration/utils.js';
import { DEFAULT_DEVOPS_API_ENDPOINTS, HttpMethods } from '@/src/lib/api/constants.js';
import type { DevOpsAPIRequestInfo } from '@/src/lib/api/clients/devops-api-http-client.js';
import { DevOpsAPIHttpClient } from '@/src/lib/api/clients/devops-api-http-client.js';
import type { Db } from '@/src/db/index.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import type { AstraFullDatabaseInfo } from '@/src/administration/types/admin/database-info.js';
import { InternalLogger } from '@/src/lib/logging/internal-logger.js';
import type { TimeoutManager } from '@/src/lib/api/timeouts/timeouts.js';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { DataAPIHttpClient } from '@/src/lib/api/clients/index.js';
import type { ParsedAdminOptions } from '@/src/client/opts-handlers/admin-opts-handler.js';
import type { ParsedTokenProvider } from '@/src/lib/token-providers/token-provider.js';
import type { ParsedRootClientOpts } from '@/src/client/opts-handlers/root-opts-handler.js';

/**
 * An administrative class for managing Astra databases, including creating, listing, and deleting keyspaces.
 *
 * **Shouldn't be instantiated directly; use {@link Db.admin} or {@link AstraDbAdmin.dbAdmin} to obtain an instance of this class.**
 *
 * To manage databases as a whole, see {@link AstraAdmin}.
 *
 * @example
 * ```typescript
 * const client = new DataAPIClient('*TOKEN*');
 *
 * // Create an admin instance through a Db
 * const db = client.db('*ENDPOINT*');
 * const dbAdmin1 = db.admin();
 * const dbAdmin2 = db.admin({ adminToken: 'stronger-token' });
 *
 * // Create an admin instance through an AstraAdmin
 * const admin = client.admin();
 * const dbAdmin3 = admin.dbAdmin('*ENDPOINT*');
 * const dbAdmin4 = admin.dbAdmin('*DB_ID*', '*REGION*');
 *
 * const keyspaces = await admin1.listKeyspaces();
 * console.log(keyspaces);
 *
 * const dbInfo = await admin1.info();
 * console.log(dbInfo);
 * ```
 *
 * @see Db.admin
 * @see AstraDbAdmin.dbAdmin
 *
 * @public
 */
export class AstraDbAdmin extends DbAdmin {
  readonly #httpClient: DevOpsAPIHttpClient;
  readonly #dataApiHttpClient: DataAPIHttpClient<'admin'>;
  readonly #db: Db;
  readonly #environment: 'dev' | 'test' | 'prod';

  /**
   * Use {@link Db.admin} or {@link AstraAdmin.dbAdmin} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(db: Db, rootOpts: ParsedRootClientOpts, adminOpts: ParsedAdminOptions, dbToken: ParsedTokenProvider, endpoint: string) {
    const loggingConfig = InternalLogger.cfg.concat([rootOpts.adminOptions.logging, adminOpts.logging]);
    super(rootOpts.client, loggingConfig);

    this.#environment = adminOpts?.astraEnv ?? rootOpts.adminOptions.astraEnv ?? extractAstraEnvironment(endpoint);

    this.#httpClient = new DevOpsAPIHttpClient({
      baseUrl: DEFAULT_DEVOPS_API_ENDPOINTS[this.#environment],
      fetchCtx: rootOpts.fetchCtx,
      logger: this,
      caller: rootOpts.caller,
      tokenProvider: TokenProvider.opts.concat([dbToken, rootOpts.adminOptions.adminToken, adminOpts.adminToken]),
      additionalHeaders: rootOpts.additionalHeaders,
      timeoutDefaults: Timeouts.cfg.concat([rootOpts.adminOptions.timeoutDefaults, adminOpts.timeoutDefaults]),
    });

    this.#dataApiHttpClient = (db._httpClient as DataAPIHttpClient).forDbAdmin(this, adminOpts);
    this.#db = db;

    Object.defineProperty(this, $CustomInspect, {
      value: () => `AstraDbAdmin()`,
    });
  }

  /**
   * Gets the ID of the Astra DB instance this object is managing.
   *
   * @returns The ID of the Astra DB instance.
   */
  public get id(): string {
    return this.#db.id;
  }

  /**
   * Gets the underlying `Db` object. The options for the db were set when the `AstraDbAdmin` instance, or whatever
   * spawned it, was created.
   *
   * @example
   * ```typescript
   * const dbAdmin = client.admin().dbAdmin('<endpoint>', {
   *   keyspace: 'my_keyspace',
   *   useHttp2: false,
   * });
   *
   * const db = dbAdmin.db();
   * console.log(db.id);
   * ```
   *
   * @returns The underlying `Db` object.
   */
  public override db(): Db {
    return this.#db;
  }

  /**
   * Fetches the complete information about the database, such as the database name, IDs, region, status, actions, and
   * other metadata.
   *
   * The method issues a request to the DevOps API each time it is invoked, without caching mechanisms;
   * this ensures up-to-date information for usages such as real-time collections validation by the application.
   *
   * @example
   * ```typescript
   * const info = await dbAdmin.info();
   * console.log(info.info.name, info.creationTime);
   * ```
   *
   * @returns A promise that resolves to the complete database information.
   */
  public async info(options?: CommandOptions<{ timeout: 'databaseAdminTimeoutMs' }>): Promise<AstraFullDatabaseInfo> {
    const tm = this.#httpClient.tm.single('databaseAdminTimeoutMs', options);
    return this.#info('dbAdmin.info', tm);
  }

  /**
   * Lists the keyspaces in the database.
   *
   * The first element in the returned array is the default keyspace of the database, and the rest are additional
   * keyspaces in no particular order.
   *
   * @example
   * ```typescript
   * const keyspaces = await dbAdmin.listKeyspaces();
   *
   * // ['default_keyspace', 'my_other_keyspace']
   * console.log(keyspaces);
   * ```
   *
   * @returns A promise that resolves to list of all the keyspaces in the database.
   */
  public override async listKeyspaces(options?: CommandOptions<{ timeout: 'keyspaceAdminTimeoutMs' }>): Promise<string[]> {
    const tm = this.#httpClient.tm.single('keyspaceAdminTimeoutMs', options);
    return this.#info('dbAdmin.listKeyspaces', tm).then(i => i.keyspaces);
  }

  /**
   * Creates a new, additional, keyspace for this database.
   *
   * **NB. this is a "long-running" operation. See {@link AstraAdminBlockingOptions} about such blocking operations.** The
   * default polling interval is 1 second. Expect it to take roughly 8-10 seconds to complete.
   *
   * @example
   * ```typescript
   * await dbAdmin.createKeyspace('my_other_keyspace1');
   *
   * // ['default_keyspace', 'my_other_keyspace1']
   * console.log(await dbAdmin.listKeyspaces());
   *
   * await dbAdmin.createKeyspace('my_other_keyspace2', {
   *   blocking: false,
   * });
   *
   * // Will not include 'my_other_keyspace2' until the operation completes
   * console.log(await dbAdmin.listKeyspaces());
   * ```
   *
   * @remarks
   * Note that if you choose not to block, the created keyspace will not be able to be used until the
   * operation completes, which is up to the caller to determine.
   *
   * @param keyspace - The name of the new keyspace.
   * @param options - The options for the blocking behavior of the operation.
   *
   * @returns A promise that resolves when the operation completes.
   */
  public override async createKeyspace(keyspace: string, options?: CreateAstraKeyspaceOptions): Promise<void> {
    if (options?.updateDbKeyspace) {
      this.#db.useKeyspace(keyspace);
    }

    const tm = this.#httpClient.tm.multipart('keyspaceAdminTimeoutMs', options);

    await this.#httpClient.requestLongRunning({
      method: HttpMethods.Post,
      path: `/databases/${this.#db.id}/keyspaces/${keyspace}`,
      methodName: 'dbAdmin.createKeyspace',
    }, {
      id: this.#db.id,
      target: 'ACTIVE',
      legalStates: ['MAINTENANCE'],
      defaultPollInterval: 1000,
      timeoutManager: tm,
      options,
    });
  }

  /**
   * Drops a keyspace from this database.
   *
   * **NB. this is a "long-running" operation. See {@link AstraAdminBlockingOptions} about such blocking operations.** The
   * default polling interval is 1 second. Expect it to take roughly 8-10 seconds to complete.
   *
   * @example
   * ```typescript
   * await dbAdmin.dropKeyspace('my_other_keyspace1');
   *
   * // ['default_keyspace', 'my_other_keyspace2']
   * console.log(await dbAdmin.listKeyspaces());
   *
   * await dbAdmin.dropKeyspace('my_other_keyspace2', {
   *   blocking: false,
   * });
   *
   * // Will still include 'my_other_keyspace2' until the operation completes
   * // ['default_keyspace', 'my_other_keyspace2']
   * console.log(await dbAdmin.listKeyspaces());
   * ```
   *
   * @remarks
   * Note that if you choose not to block, the keyspace will still be able to be used until the operation
   * completes, which is up to the caller to determine.
   *
   * @param keyspace - The name of the keyspace to drop.
   * @param options - The options for the blocking behavior of the operation.
   *
   * @returns A promise that resolves when the operation completes.
   */
  public override async dropKeyspace(keyspace: string, options?: DropAstraKeyspaceOptions): Promise<void> {
    const tm = this.#httpClient.tm.multipart('keyspaceAdminTimeoutMs', options);

    await this.#httpClient.requestLongRunning({
      method: HttpMethods.Delete,
      path: `/databases/${this.#db.id}/keyspaces/${keyspace}`,
      methodName: 'dbAdmin.dropKeyspace',
    }, {
      id: this.#db.id,
      target: 'ACTIVE',
      legalStates: ['MAINTENANCE'],
      defaultPollInterval: 1000,
      timeoutManager: tm,
      options,
    });
  }

  /**
   * Drops the database.
   *
   * **NB. this is a long-running operation. See {@link AstraAdminBlockingOptions} about such blocking operations.** The
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
  public async drop(options?: DropAstraKeyspaceOptions): Promise<void> {
    const tm = this.#httpClient.tm.multipart('databaseAdminTimeoutMs', options);

    await this.#httpClient.requestLongRunning({
      method: HttpMethods.Post,
      path: `/databases/${this.#db.id}/terminate`,
      methodName: 'dbAdmin.drop',
    }, {
      id: this.#db.id,
      target: 'TERMINATED',
      legalStates: ['TERMINATING'],
      defaultPollInterval: 10000,
      timeoutManager: tm,
      options,
    });
  }

  public get _httpClient(): OpaqueHttpClient {
    return this.#httpClient;
  }

  async #info(methodName: DevOpsAPIRequestInfo['methodName'], tm: TimeoutManager): Promise<AstraFullDatabaseInfo> {
    const resp = await this.#httpClient.request({
      method: HttpMethods.Get,
      path: `/databases/${this.#db.id}`,
      methodName,
    }, tm);

    return buildAstraDatabaseAdminInfo(resp.data!, this.#environment);
  }

  /**
   * @internal
   */
  protected override _getDataAPIHttpClient(): DataAPIHttpClient<'admin'> {
    return this.#dataApiHttpClient;
  }
}
