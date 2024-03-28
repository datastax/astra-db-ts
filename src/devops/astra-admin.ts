import { AdminBlockingOptions, DatabaseConfig, FullDatabaseInfo, ListDatabasesOptions } from '@/src/devops/types';
import { Db, mkDb } from '@/src/data-api';
import { DEFAULT_DEVOPS_API_ENDPOINT, DevopsApiHttpClient, HTTP_METHODS } from '@/src/api';
import { AstraDbAdmin } from '@/src/devops/astra-db-admin';
import { AdminSpawnOptions, DbSpawnOptions, RootClientOptsWithToken } from '@/src/client/types';

type AdminOptions = RootClientOptsWithToken & { devopsOptions: { adminToken: string } };

export class AstraAdmin {
  readonly #defaultOpts!: RootClientOptsWithToken;

  private readonly _httpClient!: DevopsApiHttpClient;

  constructor(options: AdminOptions) {
    const adminOpts = options.devopsOptions ?? {};

    this.#defaultOpts = options;

    Object.defineProperty(this, '_httpClient', {
      value: new DevopsApiHttpClient({
        baseUrl: adminOpts.endpointUrl || DEFAULT_DEVOPS_API_ENDPOINT,
        applicationToken: adminOpts.adminToken,
        caller: options.caller,
        logLevel: options.logLevel,
      }),
      enumerable: false,
    });
  }

  db(endpoint: string, options?: DbSpawnOptions): Db;

  db(id: string, region: string, options?: DbSpawnOptions): Db;

  db(endpointOrId: string, regionOrOptions?: string | DbSpawnOptions, maybeOptions?: DbSpawnOptions): Db {
    return mkDb(this.#defaultOpts, endpointOrId, regionOrOptions, maybeOptions);
  }

  dbAdmin(endpoint: string, options?: DbSpawnOptions): AstraDbAdmin;

  dbAdmin(id: string, region: string, options?: DbSpawnOptions): AstraDbAdmin;

  dbAdmin(endpointOrId: string, regionOrOptions?: string | DbSpawnOptions, maybeOptions?: DbSpawnOptions): AstraDbAdmin {
    // @ts-expect-error - calls internal representation of method
    return this.db(endpointOrId, regionOrOptions, maybeOptions).admin(this.#defaultOpts.devopsOptions);
  }

  public async listDatabases(options?: ListDatabasesOptions): Promise<FullDatabaseInfo[]> {
    const resp = await this._httpClient.request({
      method: HTTP_METHODS.Get,
      path: `/databases`,
      params: {
        include: options?.include,
        provider: options?.provider,
        limit: options?.limit,
        starting_after: options?.skip,
      },
    });
    return resp.data;
  }

  public async createDatabase(config: DatabaseConfig, options?: AdminBlockingOptions): Promise<AstraDbAdmin> {
    const resp = await this._httpClient.request({
      method: HTTP_METHODS.Post,
      path: '/databases',
      data: {
        capacityUnits: 1,
        tier: 'serverless',
        dbType: 'vector',
        ...config,
      },
    });

    const db = mkDb(this.#defaultOpts, resp.headers.location, config.region, { namespace: resp.data.info.keyspace });
    const admin = db.admin(this.#defaultOpts.devopsOptions);

    await this._httpClient.awaitStatus(db, 'ACTIVE', ['INITIALIZING', 'PENDING'], options, 10000);
    return admin;
  }

  async dropDatabase(_db: Db | string, options?: AdminBlockingOptions): Promise<void> {
    const id = typeof _db === 'string' ? _db : _db.id;

    await this._httpClient.request({
      method: HTTP_METHODS.Post,
      path: `/databases/${id}/terminate`,
    });
    await this._httpClient.awaitStatus({ id }, 'TERMINATED', ['TERMINATING'], options, 10000);
  }
}

/**
 * @internal
 */
export function mkAdmin(rootOpts: RootClientOptsWithToken, options?: AdminSpawnOptions): AstraAdmin {
  return new AstraAdmin({
    ...rootOpts,
    devopsOptions: {
      ...rootOpts?.devopsOptions,
      ...options,
    },
  });
}
