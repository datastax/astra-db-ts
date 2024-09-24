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

import {
  AdminBlockingOptions,
  AdminSpawnOptions,
  CreateKeyspaceOptions,
  CreateNamespaceOptions,
  FullDatabaseInfo,
} from '@/src/administration/types';
import { DbAdmin } from '@/src/administration/db-admin';
import { WithTimeout } from '@/src/lib/types';
import { InternalRootClientOpts } from '@/src/client/types';
import { extractAstraEnvironment, validateAdminOpts } from '@/src/administration/utils';
import { FindEmbeddingProvidersResult } from '@/src/administration/types/db-admin/find-embedding-providers';
import { DEFAULT_DEVOPS_API_ENDPOINTS, HttpMethods } from '@/src/lib/api/constants';
import { DevOpsAPIHttpClient } from '@/src/lib/api/clients/devops-api-http-client';
import { Db } from '@/src/db';
import { StaticTokenProvider, TokenProvider } from '@/src/lib';
import { isNullish } from '@/src/lib/utils';

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
  readonly #db: Db;

  /**
   * Use {@link Db.admin} or {@link AstraAdmin.dbAdmin} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(db: Db, rootOpts: InternalRootClientOpts, adminOpts: AdminSpawnOptions | undefined, dbToken: TokenProvider, endpoint: string) {
    super();

    validateAdminOpts(adminOpts);

    const combinedAdminOpts = {
      ...rootOpts.adminOptions,
      ...adminOpts,
    };

    const _adminToken = TokenProvider.parseToken(adminOpts?.adminToken ?? rootOpts.adminOptions.adminToken);

    const adminToken = (_adminToken instanceof StaticTokenProvider && isNullish(_adminToken.getToken()))
      ? dbToken
      : _adminToken;

    const environment = extractAstraEnvironment(endpoint);

    this.#httpClient = new DevOpsAPIHttpClient({
      baseUrl: combinedAdminOpts.endpointUrl ?? DEFAULT_DEVOPS_API_ENDPOINTS[environment],
      monitorCommands: combinedAdminOpts.monitorCommands,
      fetchCtx: rootOpts.fetchCtx,
      emitter: rootOpts.emitter,
      userAgent: rootOpts.userAgent,
      tokenProvider: adminToken,
    });

    this.#db = db;
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
   *   keyspace: 'my-keyspace',
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
    return this.#db;
  }

  /**
   * Returns detailed information about the availability and usage of the vectorize embedding providers available on the
   * current database (may vary based on cloud provider & region).
   *
   * @example
   * ```typescript
   * const { embeddingProviders } = await dbAdmin.findEmbeddingProviders();
   *
   * // ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002']
   * console.log(embeddingProviders['openai'].models.map(m => m.name));
   * ```
   *
   * @param options - The options for the timeout of the operation.
   *
   * @returns The available embedding providers.
   */
  public override async findEmbeddingProviders(options?: WithTimeout): Promise<FindEmbeddingProvidersResult> {
    const resp = await this.#db.command({ findEmbeddingProviders: {} }, { keyspace: null, maxTimeMS: options?.maxTimeMS });
    return resp.status as FindEmbeddingProvidersResult;
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
    const resp = await this.#httpClient.request({
      method: HttpMethods.Get,
      path: `/databases/${this.#db.id}`,
    }, options);

    return resp.data as FullDatabaseInfo;
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
  public override async listKeyspaces(options?: WithTimeout): Promise<string[]> {
    return this.info(options).then(i => [i.info.keyspace!, ...i.info.additionalKeyspaces ?? []].filter(Boolean));
  }

  /**
   * Lists the keyspaces in the database.
   *
   * This is now a deprecated alias for the strictly equivalent {@link AstraDbAdmin.listKeyspaces}, and will be removed
   * in an upcoming major version.
   *
   * @deprecated - Prefer {@link AstraDbAdmin.listKeyspaces} instead.
   */
  public override async listNamespaces(options?: WithTimeout): Promise<string[]> {
    return this.listKeyspaces(options);
  }

  /**
   * Creates a new, additional, keyspace for this database.
   *
   * **NB. this is a "long-running" operation. See {@link AdminBlockingOptions} about such blocking operations.** The
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
   *   blocking: false,
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
  public override async createKeyspace(keyspace: string, options?: CreateKeyspaceOptions): Promise<void> {
    if (options?.updateDbKeyspace) {
      this.#db.useKeyspace(keyspace);
    }

    await this.#httpClient.requestLongRunning({
      method: HttpMethods.Post,
      path: `/databases/${this.#db.id}/keyspaces/${keyspace}`,
    }, {
      id: this.#db.id,
      target: 'ACTIVE',
      legalStates: ['MAINTENANCE'],
      defaultPollInterval: 1000,
      options,
    });
  }

  /**
   * Creates a new, additional, keyspace for this database.
   *
   * This is now a deprecated alias for the strictly equivalent {@link AstraDbAdmin.createKeyspace}, and will be removed
   * in an upcoming major version.
   *
   * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
   *
   * @deprecated - Prefer {@link AstraDbAdmin.createKeyspace} instead.
   */
  public override async createNamespace(keyspace: string, options?: CreateNamespaceOptions): Promise<void> {
    return this.createKeyspace(keyspace, { ...options, updateDbKeyspace: options?.updateDbNamespace });
  }

  /**
   * Drops a keyspace from this database.
   *
   * **NB. this is a "long-running" operation. See {@link AdminBlockingOptions} about such blocking operations.** The
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
   *   blocking: false,
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
  public override async dropKeyspace(keyspace: string, options?: AdminBlockingOptions): Promise<void> {
    await this.#httpClient.requestLongRunning({
      method: HttpMethods.Delete,
      path: `/databases/${this.#db.id}/keyspaces/${keyspace}`,
    }, {
      id: this.#db.id,
      target: 'ACTIVE',
      legalStates: ['MAINTENANCE'],
      defaultPollInterval: 1000,
      options,
    });
  }

  /**
   Drops a keyspace from this database.
   *
   * This is now a deprecated alias for the strictly equivalent {@link AstraDbAdmin.dropKeyspace}, and will be removed
   * in an upcoming major version.
   *
   * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
   *
   * @deprecated - Prefer {@link AstraDbAdmin.dropKeyspace} instead.
   */
  public override async dropNamespace(keyspace: string, options?: AdminBlockingOptions): Promise<void> {
    return this.dropKeyspace(keyspace, options);
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
    await this.#httpClient.requestLongRunning({
      method: HttpMethods.Post,
      path: `/databases/${this.#db.id}/terminate`,
    }, {
      id: this.#db.id,
      target: 'TERMINATED',
      legalStates: ['TERMINATING'],
      defaultPollInterval: 10000,
      options,
    });
  }

  private get _httpClient() {
    return this.#httpClient;
  }
}
