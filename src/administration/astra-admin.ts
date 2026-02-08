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

import type {
  AstraDatabaseConfig,
  CreateAstraDatabaseOptions,
  ListAstraDatabasesOptions,
  AstraAvailableRegionInfo, AstraFindAvailableRegionsOptions,
} from '@/src/administration/types/index.js';
import { AstraDbAdmin } from '@/src/administration/astra-db-admin.js';
import { Db } from '@/src/db/db.js';
import { buildAstraDatabaseAdminInfo } from '@/src/administration/utils.js';
import { DEFAULT_DEVOPS_API_ENDPOINTS, DEFAULT_KEYSPACE, HttpMethods } from '@/src/lib/api/constants.js';
import { DevOpsAPIHttpClient } from '@/src/lib/api/clients/devops-api-http-client.js';
import type { CommandOptions, OpaqueHttpClient } from '@/src/lib/index.js';
import { HierarchicalLogger, TokenProvider } from '@/src/lib/index.js';
import type { AstraFullDatabaseInfo } from '@/src/administration/types/admin/database-info.js';
import { buildAstraEndpoint } from '@/src/lib/utils.js';
import type { DbOptions } from '@/src/client/index.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import type { SomeDoc } from '@/src/documents/index.js';
import { Timeouts } from '@/src/lib/api/timeouts/timeouts.js';
import type { AstraDropDatabaseOptions } from '@/src/administration/types/admin/drop-database.js';
import type { ParsedAdminOptions } from '@/src/client/opts-handlers/admin-opts-handler.js';
import { AdminOptsHandler } from '@/src/client/opts-handlers/admin-opts-handler.js';
import { DbOptsHandler } from '@/src/client/opts-handlers/db-opts-handler.js';
import type { ParsedRootClientOpts } from '@/src/client/opts-handlers/root-opts-handler.js';
import type { AdminCommandEventMap } from '@/src/administration/events.js';

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
export class AstraAdmin extends HierarchicalLogger<AdminCommandEventMap> {
  readonly #defaultOpts: ParsedRootClientOpts;
  readonly #httpClient: DevOpsAPIHttpClient;
  readonly #environment: 'dev' | 'test' | 'prod';

  /**
   * Use {@link DataAPIClient.admin} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(rootOpts: ParsedRootClientOpts, adminOpts: ParsedAdminOptions) {
    const defaultOpts = {
      ...rootOpts,
      adminOptions: AdminOptsHandler.concat([rootOpts.adminOptions, adminOpts]),
      dbOptions: {
        ...rootOpts.dbOptions,
        token: TokenProvider.opts.concat([rootOpts.adminOptions.adminToken, adminOpts?.adminToken, rootOpts.dbOptions.token]),
      },
    };

    super(rootOpts.client, defaultOpts.adminOptions.logging);
    
    this.#defaultOpts = defaultOpts;
    this.#environment = this.#defaultOpts.adminOptions.astraEnv ?? 'prod';

    this.#httpClient = new DevOpsAPIHttpClient({
      baseUrl: this.#defaultOpts.adminOptions.endpointUrl ?? DEFAULT_DEVOPS_API_ENDPOINTS[this.#environment],
      logger: this,
      fetchCtx: rootOpts.fetchCtx,
      caller: rootOpts.caller,
      tokenProvider: this.#defaultOpts.adminOptions.adminToken,
      additionalHeaders: this.#defaultOpts.additionalHeaders,
      timeoutDefaults: Timeouts.cfg.concat([rootOpts.adminOptions.timeoutDefaults, this.#defaultOpts.adminOptions.timeoutDefaults]),
    });

    Object.defineProperty(this, $CustomInspect, {
      value: () => 'AstraAdmin()',
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
   *   keyspace: 'my_keyspace',
   *   useHttp2: false,
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
  public db(endpoint: string, options?: DbOptions): Db;

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
   *   keyspace: 'my_keyspace',
   *   useHttp2: false,
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
  public db(id: string, region: string, options?: DbOptions): Db;

  public db(endpointOrId: string, regionOrOptions?: string | DbOptions, maybeOptions?: DbOptions): Db {
    const [endpoint, dbOpts] = resolveEndpointOrIdOverload(endpointOrId, regionOrOptions, maybeOptions);
    return new Db(this.#defaultOpts, endpoint, DbOptsHandler.parse(dbOpts));
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
   *   keyspace: 'my_keyspace',
   *   useHttp2: false,
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
  public dbAdmin(endpoint: string, options?: DbOptions): AstraDbAdmin;

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
   *   keyspace: 'my_keyspace',
   *   useHttp2: false,
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
  public dbAdmin(id: string, region: string, options?: DbOptions): AstraDbAdmin;

  public dbAdmin(endpointOrId: string, regionOrOptions?: string | DbOptions, maybeOptions?: DbOptions): AstraDbAdmin {
    const [endpoint, dbOpts] = resolveEndpointOrIdOverload(endpointOrId, regionOrOptions, maybeOptions);

    return new AstraDbAdmin(
      this.db(endpoint, dbOpts),
      this.#defaultOpts,
      AdminOptsHandler.empty,
      this.#defaultOpts.dbOptions.token,
      endpoint,
    );
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
  public async dbInfo(id: string, options?: CommandOptions<{ timeout: 'databaseAdminTimeoutMs' }>): Promise<AstraFullDatabaseInfo> {
    const tm = this.#httpClient.tm.single('databaseAdminTimeoutMs', options);

    const resp = await this.#httpClient.request({
      method: HttpMethods.Get,
      path: `/databases/${id}`,
      methodName: 'admin.dbInfo',
    }, tm);

    return buildAstraDatabaseAdminInfo(resp.data!, this.#environment);
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
   * See {@link ListAstraDatabasesOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * const admin = new DataAPIClient('AstraCS:...').admin();
   *
   * const activeDbs = await admin.listDatabases({ include: 'ACTIVE' });
   *
   * for (const db of activeDbs) {
   *   console.log(`Database ${db.name} is active`);
   * }
   * ```
   *
   * @param options - The options to filter the databases by.
   * @returns A list of the complete information for all the databases matching the given filter.
   */
  public async listDatabases(options?: ListAstraDatabasesOptions): Promise<AstraFullDatabaseInfo[]> {
    const params = {} as Record<string, string>;

    if (typeof options?.include === 'string') {
      params.include = options.include;
    }

    if (typeof options?.provider === 'string') {
      params.provider = options.provider;
    }

    if (typeof options?.limit === 'number') {
      params.limit = String(options.limit);
    }

    /* c8 ignore next 3: this is a stupid parameter which I can't be bothered to test */
    if (typeof options?.startingAfter === 'string') {
      params.starting_after = options.startingAfter;
    }

    const tm = this.#httpClient.tm.single('databaseAdminTimeoutMs', options);

    const resp = await this.#httpClient.request({
      method: HttpMethods.Get,
      path: `/databases`,
      params: params,
      methodName: 'admin.listDatabases',
    }, tm);

    return resp.data!.map((d: SomeDoc) => buildAstraDatabaseAdminInfo(d, this.#environment));
  }

  /**
   * Creates a new database with the given configuration.
   *
   * **NB. this is a long-running operation. See {@link AstraAdminBlockingOptions} about such blocking operations.** The
   * default polling interval is 10 seconds. Expect it to take roughly 2 min to complete.
   *
   * Note that **the `name` field is non-unique** and thus creating a database, even with the same options, is **not
   * idempotent**.
   *
   * You may also provide options for the implicit {@link Db} instance that will be created with the database, which
   * will override any default options set when creating the {@link DataAPIClient} through a deep merge (i.e. unset
   * properties in the options object will just default to the default options).
   *
   * See {@link CreateAstraDatabaseOptions} for complete information about the options available for this operation.
   *
   * @example
   * ```typescript
   * const newDbAdmin1 = await admin.createDatabase({
   *   name: 'my_database_1',
   *   cloudProvider: 'GCP',
   *   region: 'us-east1',
   * });
   *
   * // Prints '[]' as there are no collections in the database yet
   * console.log(newDbAdmin1.db().listCollections());
   *
   * const newDbAdmin2 = await admin.createDatabase({
   *   name: 'my_database_2',
   *   cloudProvider: 'GCP',
   *   region: 'us-east1',
   *   keyspace: 'my_keyspace',
   * }, {
   *   blocking: false,
   *   dbOptions: {
   *     useHttp2: false,
   *     token: '<weaker-token>',
   *   },
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
  public async createDatabase(config: AstraDatabaseConfig, options?: CreateAstraDatabaseOptions): Promise<AstraDbAdmin> {
    const definition = {
      capacityUnits: 1,
      tier: 'serverless',
      dbType: 'vector',
      keyspace: config.keyspace || DEFAULT_KEYSPACE,
      ...config,
    };

    const tm = this.#httpClient.tm.multipart('databaseAdminTimeoutMs', options);

    const resp = await this.#httpClient.requestLongRunning({
      method: HttpMethods.Post,
      path: '/databases',
      data: definition,
      methodName: 'admin.createDatabase',
    }, {
      id: (resp) => resp.headers.location,
      target: 'ACTIVE',
      legalStates: ['INITIALIZING', 'PENDING', 'ASSOCIATING'],
      defaultPollInterval: 10000,
      timeoutManager: tm,
      options,
    });

    const endpoint = buildAstraEndpoint(resp.headers.location, definition.region);
    const db = this.db(endpoint, { ...options?.dbOptions, keyspace: definition.keyspace });
    return new AstraDbAdmin(db, this.#defaultOpts, AdminOptsHandler.empty, this.#defaultOpts.adminOptions.adminToken, endpoint);
  }

  /**
   * Terminates a database by ID or by a given {@link Db} instance.
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
  public async dropDatabase(db: Db | string, options?: AstraDropDatabaseOptions): Promise<void> {
    const id = typeof db === 'string' ? db : db.id;

    const tm = this.#httpClient.tm.multipart('databaseAdminTimeoutMs', options);

    await this.#httpClient.requestLongRunning({
      method: HttpMethods.Post,
      path: `/databases/${id}/terminate`,
      methodName: 'admin.dropDatabase',
    }, {
      id: id,
      target: 'TERMINATED',
      legalStates: ['TERMINATING'],
      defaultPollInterval: 10000,
      timeoutManager: tm,
      options,
    });
  }

  /**
   * ##### Overview
   *
   * Finds available regions for Astra database deployments.
   *
   * The returned information includes details about each region such as its cloud provider,
   * classification tier, geographic zone, and availability status.
   *
   * @example
   * ```ts
   * // Find all regions enabled for the current organization (default)
   * const enabledRegions = await admin.findAvailableRegions();
   *
   * // Find AWS regions in North America
   * const awsNaRegions = allRegions
   *   .filter(r => r.cloudProvider === 'AWS' && r.zone === 'na');
   * ```
   *
   * ---
   *
   * ##### Including non-org-enabled regions
   *
   * By default, it returns only regions that are enabled for the current organization, but this behavior can be controlled with the {@link AstraFindAvailableRegionsOptions.onlyOrgEnabledRegions} option.
   *
   * @example
   * ```ts
   * // Find all regions, including those not enabled for the current organization
   * const allRegions = await admin.findAvailableRegions({
   *   onlyOrgEnabledRegions: false,
   * });
   * ```
   *
   * @param options - Options for filtering the regions to return
   *
   * @returns A promise that resolves to an array of the region information
   *
   * @see AstraAvailableRegionInfo
   * @see AstraRegionClassification
   */
  public async findAvailableRegions(options?: AstraFindAvailableRegionsOptions): Promise<AstraAvailableRegionInfo[]> {
    const tm = this.#httpClient.tm.single('databaseAdminTimeoutMs', options);

    const filterByOrg = options?.onlyOrgEnabledRegions !== false ? 'enabled' : 'disabled';

    const resp = await this.#httpClient.request({
      method: HttpMethods.Get,
      path: '/regions/serverless',
      params: {
        'filter-by-org': filterByOrg,
        'region-type': 'vector',
      },
      methodName: 'admin.findAvailableRegions',
    }, tm);

    return resp.data!.map((region: any): AstraAvailableRegionInfo => ({
      classification: region.classification,
      cloudProvider: region.cloudProvider,
      displayName: region.displayName,
      enabled: region.enabled,
      name: region.name,
      reservedForQualifiedUsers: region.reservedForQualifiedUsers,
      zone: region.zone,
    }));
  }

  public get _httpClient(): OpaqueHttpClient {
    return this.#httpClient;
  }
}

const resolveEndpointOrIdOverload = (endpointOrId: string, regionOrOptions?: string | DbOptions, maybeOptions?: DbOptions): [string, DbOptions?] => {
  const dbOpts = (typeof regionOrOptions === 'string')
    ? maybeOptions
    : regionOrOptions;

  if (typeof regionOrOptions === 'string' && (endpointOrId.startsWith('http'))) {
    throw new Error('Unexpected db() argument: database id can\'t start with "http(s)://". Did you mean to call `.db(endpoint, { keyspace })`?');
  }

  const endpoint = (typeof regionOrOptions === 'string')
    ? 'https://' + endpointOrId + '-' + regionOrOptions + '.apps.astra.datastax.com'
    : endpointOrId;

  return [endpoint, dbOpts];
};
