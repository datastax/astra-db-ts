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
  CreateDatabaseOptions,
  DatabaseConfig,
  FullDatabaseInfo,
  ListDatabasesOptions,
} from '@/src/administration/types';
import { AstraDbAdmin } from '@/src/administration/astra-db-admin';
import { DbSpawnOptions, InternalRootClientOpts } from '@/src/client/types';
import { Db, mkDb } from '@/src/db/db';
import { validateAdminOpts } from '@/src/administration/utils';
import { DEFAULT_DEVOPS_API_ENDPOINTS, DEFAULT_KEYSPACE, HttpMethods } from '@/src/lib/api/constants';
import { DevOpsAPIHttpClient } from '@/src/lib/api/clients/devops-api-http-client';
import { TokenProvider, WithTimeout } from '@/src/lib';
import { resolveKeyspace } from '@/src/lib/utils';

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
export class AstraAdmin {
  readonly #defaultOpts: InternalRootClientOpts;
  readonly #httpClient: DevOpsAPIHttpClient;

  /**
   * Use {@link DataAPIClient.admin} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(rootOpts: InternalRootClientOpts, adminOpts?: AdminSpawnOptions) {
    validateAdminOpts(adminOpts);

    this.#defaultOpts = rootOpts;

    const combinedAdminOpts = {
      ...rootOpts.adminOptions,
      ...adminOpts,
      adminToken: TokenProvider.parseToken(adminOpts?.adminToken ?? rootOpts.adminOptions.adminToken),
    };

    this.#httpClient = new DevOpsAPIHttpClient({
      baseUrl: combinedAdminOpts.endpointUrl || DEFAULT_DEVOPS_API_ENDPOINTS.prod,
      monitorCommands: combinedAdminOpts.monitorCommands,
      emitter: rootOpts.emitter,
      fetchCtx: rootOpts.fetchCtx,
      userAgent: rootOpts.userAgent,
      tokenProvider: combinedAdminOpts.adminToken,
    });
  }

  /**
   * Spawns a new {@link Db} instance using a direct endpoint and given options.
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
   * const admin = new DataAPIClient('token').admin();
   *
   * const db1 = admin.db('https://<db_id>-<region>.apps.astra.datastax.com');
   *
   * const db2 = admin.db('https://<db_id>-<region>.apps.astra.datastax.com', {
   *   keyspace: 'my-keyspace',
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
   * This overload is purely for user convenience, but it **only supports using Astra as the underlying database**. For
   * DSE or any other Data-API-compatible endpoint, use the other overload instead.
   *
   * The given options will override any default options set when creating the {@link DataAPIClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
   *
   * @example
   * ```typescript
   * const admin = new DataAPIClient('token').admin();
   *
   * const db1 = admin.db('a6a1d8d6-31bc-4af8-be57-377566f345bf', 'us-east1');
   *
   * const db2 = admin.db('a6a1d8d6-31bc-4af8-be57-377566f345bf', 'us-east1', {
   *   keyspace: 'my-keyspace',
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
    return mkDb(this.#defaultOpts, endpointOrId, regionOrOptions, maybeOptions);
  }

  /**
   * Spawns a new {@link AstraDbAdmin} instance for a database using a direct endpoint and given options.
   *
   * This endpoint should include the protocol and the hostname, but not the path. It's typically in the form of
   * `https://<db_id>-<region>.apps.astra.datastax.com`, but it can be used with DSE or any other Data-API-compatible
   * endpoint.
   *
   * The given options are for the underlying implicitly-created {@link Db} instance, not the {@link AstraDbAdmin} instance.
   * The db admin will use the same options as this {@link AstraAdmin} instance.
   *
   * The given options will override any default options set when creating the {@link DataAPIClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
   *
   * @example
   * ```typescript
   * const admin = new DataAPIClient('token').admin();
   *
   * const dbAdmin1 = admin.dbAdmin('https://<db_id>-<region>...');
   *
   * const dbAdmin2 = admin.dbAdmin('https://<db_id>-<region>...', {
   *   keyspace: 'my-keyspace',
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
  public dbAdmin(endpoint: string, options?: DbSpawnOptions): AstraDbAdmin;

  /**
   * Spawns a new {@link Db} instance using a direct endpoint and given options.
   *
   * This overload is purely for user convenience, but it **only supports using Astra as the underlying database**. For
   * DSE or any other Data-API-compatible endpoint, use the other overload instead.
   *
   * The given options are for the underlying implicitly-created {@link Db} instance, not the {@link AstraDbAdmin} instance.
   * The db admin will use the same options as this {@link AstraAdmin} instance.
   *
   * The given options will override any default options set when creating the {@link DataAPIClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
   *
   * @example
   * ```typescript
   * const admin = new DataAPIClient('token').admin();
   *
   * const dbAdmin1 = admin.dbAdmin('a6a1d8d6-...-377566f345bf', 'us-east1');
   *
   * const dbAdmin2 = admin.dbAdmin('a6a1d8d6-...-377566f345bf', 'us-east1', {
   *   keyspace: 'my-keyspace',
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
  public dbAdmin(id: string, region: string, options?: DbSpawnOptions): AstraDbAdmin;

  public dbAdmin(endpointOrId: string, regionOrOptions?: string | DbSpawnOptions, maybeOptions?: DbSpawnOptions): AstraDbAdmin {
    /* @ts-expect-error - calls internal representation of method */
    return this.db(endpointOrId, regionOrOptions, maybeOptions).admin(this.#defaultOpts.adminOptions);
  }

  /**
   * Fetches the complete information about the database, such as the database name, IDs, region, status, actions, and
   * other metadata.
   *
   * @example
   * ```typescript
   * const info = await admin.info('<db_id>');
   * console.log(info.info.name, info.creationTime);
   * ```
   *
   * @returns A promise that resolves to the complete database information.
   */
  public async dbInfo(id: string, options?: WithTimeout): Promise<FullDatabaseInfo> {
    const resp = await this.#httpClient.request({
      method: HttpMethods.Get,
      path: `/databases/${id}`,
    }, options);

    return resp.data as FullDatabaseInfo;
  }

  /**
   * Lists all databases in the current org/account, matching the optionally provided filter.
   *
   * Note that this method is paginated, but the page size is high enough that most users won't need to worry about it.
   * However, you can use the `limit` and `skip` options to control the number of results returned and the starting point
   * for the results, as needed.
   *
   * You can also filter by the database status using the `include` option, and by the database provider using the
   * `provider` option.
   *
   * See {@link ListDatabasesOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * const admin = new DataAPIClient('AstraCS:...').admin();
   *
   * const activeDbs = await admin.listDatabases({ include: 'ACTIVE' });
   *
   * for (const db of activeDbs) {
   *   console.log(`Database ${db.name} is active`);
   * }
   * ```
   *
   * @param options - The options to filter the databases by.
   * @returns A list of the complete information for all the databases matching the given filter.
   */
  public async listDatabases(options?: ListDatabasesOptions): Promise<FullDatabaseInfo[]> {
    const params = {} as Record<string, string>;

    if (typeof options?.include === 'string') {
      (params['include'] = options.include);
    }

    if (typeof options?.provider === 'string') {
      (params['provider'] = options.provider);
    }

    if (typeof options?.limit === 'number') {
      (params['limit'] = String(options.skip));
    }

    if (typeof options?.skip === 'number') {
      (params['starting_after'] = String(options.skip));
    }

    const resp = await this.#httpClient.request({
      method: HttpMethods.Get,
      path: `/databases`,
      params: params,
    }, options);

    return resp.data as FullDatabaseInfo[];
  }

  /**
   * Creates a new database with the given configuration.
   *
   * **NB. this is a long-running operation. See {@link AdminBlockingOptions} about such blocking operations.** The
   * default polling interval is 10 seconds. Expect it to take roughly 2 min to complete.
   *
   * Note that **the `name` field is non-unique** and thus creating a database, even with the same options, is **not
   * idempotent**.
   *
   * You may also provide options for the implicit {@link Db} instance that will be created with the database, which
   * will override any default options set when creating the {@link DataAPIClient} through a deep merge (i.e. unset
   * properties in the options object will just default to the default options).
   *
   * See {@link CreateDatabaseOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * const newDbAdmin1 = await admin.createDatabase({
   *   name: 'my_database_1',
   *   cloudProvider: 'GCP',
   *   region: 'us-east1',
   * });
   *
   * // Prints '[]' as there are no collections in the database yet
   * console.log(newDbAdmin1.db().listCollections());
   *
   * const newDbAdmin2 = await admin.createDatabase({
   *   name: 'my_database_2',
   *   cloudProvider: 'GCP',
   *   region: 'us-east1',
   *   keyspace: 'my_keyspace',
   * }, {
   *   blocking: false,
   *   dbOptions: {
   *     useHttp2: false,
   *     token: '<weaker-token>',
   *   },
   * });
   *
   * // Can't do much else as the database is still initializing
   * console.log(newDbAdmin2.db().id);
   * ```
   *
   * @remarks
   * Note that if you choose not to block, the returned {@link AstraDbAdmin} object will not be very useful until the
   * operation completes, which is up to the caller to determine.
   *
   * @param config - The configuration for the new database.
   * @param options - The options for the blocking behavior of the operation.
   *
   * @returns The AstraDbAdmin instance for the newly created database.
   */
  public async createDatabase(config: DatabaseConfig, options?: CreateDatabaseOptions): Promise<AstraDbAdmin> {
    const definition = {
      capacityUnits: 1,
      tier: 'serverless',
      dbType: 'vector',
      keyspace: resolveKeyspace(config) || DEFAULT_KEYSPACE,
      ...config,
    };

    const resp = await this.#httpClient.requestLongRunning({
      method: HttpMethods.Post,
      path: '/databases',
      data: definition,
    }, {
      id: (resp) => resp.headers.location,
      target: 'ACTIVE',
      legalStates: ['INITIALIZING', 'PENDING'],
      defaultPollInterval: 10000,
      options,
    });

    const db = mkDb(this.#defaultOpts, resp.headers.location, definition.region, { ...options?.dbOptions, keyspace: definition.keyspace });
    return db.admin(this.#defaultOpts.adminOptions);
  }

  /**
   * Terminates a database by ID or by a given {@link Db} instance.
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
   * await admin.dropDatabase(db);
   *
   * // Or just
   * await admin.dropDatabase('a6a1d8d6-31bc-4af8-be57-377566f345bf');
   * ```
   *
   * @param db - The database to drop, either by ID or by instance.
   * @param options - The options for the blocking behavior of the operation.
   *
   * @returns A promise that resolves when the operation completes.
   *
   * @remarks Use with caution. Wear a harness. Don't say I didn't warn you.
   */
  async dropDatabase(db: Db | string, options?: AdminBlockingOptions): Promise<void> {
    const id = typeof db === 'string' ? db : db.id;

    await this.#httpClient.requestLongRunning({
      method: HttpMethods.Post,
      path: `/databases/${id}/terminate`,
    }, {
      id: id,
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
