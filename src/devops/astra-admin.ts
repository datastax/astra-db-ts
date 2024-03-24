import {
  CreateDatabaseAsyncOptions,
  CreateDatabaseBlockingOptions,
  CreateDatabaseOptions,
  DatabaseConfig,
  FullDatabaseInfo,
  ListDatabasesOptions
} from '@/src/devops/types';
import { Db, mkDb } from '@/src/data-api';
import { DEFAULT_DEVOPS_API_ENDPOINT, DevopsApiHttpClient, HTTP_METHODS } from '@/src/api';
import { DevopsUnexpectedStateError } from '@/src/devops/errors';
import { AstraDbAdmin } from '@/src/devops/astra-db-admin';
import { AdminSpawnOptions, DbSpawnOptions, RootClientOptsWithToken } from '@/src/client/types';

type AdminOptions = RootClientOptsWithToken & { devopsOptions: { adminToken: string } };

export class AstraAdmin {
  private readonly _httpClient: DevopsApiHttpClient;
  private readonly _defaultOpts: RootClientOptsWithToken;

  constructor(options: AdminOptions) {
    const adminOpts = options.devopsOptions ?? {};

    this._defaultOpts = options;

    this._httpClient = new DevopsApiHttpClient({
      baseUrl: adminOpts.endpointUrl || DEFAULT_DEVOPS_API_ENDPOINT,
      applicationToken: adminOpts.adminToken,
      caller: options.caller,
      logLevel: options.logLevel,
    });
  }

  db(endpoint: string, options?: DbSpawnOptions): Db;

  db(id: string, region: string, options?: DbSpawnOptions): Db;

  db(endpointOrId: string, regionOrOptions?: string | DbSpawnOptions, maybeOptions?: DbSpawnOptions): Db {
    return mkDb(this._defaultOpts, endpointOrId, regionOrOptions, maybeOptions);
  }

  dbAdmin(endpoint: string, options?: DbSpawnOptions): AstraDbAdmin;

  dbAdmin(id: string, region: string, options?: DbSpawnOptions): AstraDbAdmin;

  dbAdmin(endpointOrId: string, regionOrOptions?: string | DbSpawnOptions, maybeOptions?: DbSpawnOptions): AstraDbAdmin {
    // @ts-expect-error - calls internal representation of method
    return this.db(endpointOrId, regionOrOptions, maybeOptions).admin(this._defaultOpts.devopsOptions);
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

  public async createDatabase(config: DatabaseConfig, options?: CreateDatabaseAsyncOptions): Promise<string>

  public async createDatabase(config: DatabaseConfig, options?: CreateDatabaseBlockingOptions): Promise<Db>

  public async createDatabase(config: DatabaseConfig, options?: CreateDatabaseOptions): Promise<string | Db> {
    const resp = await this._httpClient.request({
      method: HTTP_METHODS.Post,
      path: '/databases',
      data: config,
    });

    const id = resp.headers.location;

    if (options?.blocking === false) {
      return id;
    }

    for (;;) {
      const resp = await this._httpClient.request({
        method: HTTP_METHODS.Get,
        path: `/databases/${id}`,
      });

      if (resp.data?.status === 'ACTIVE') {
        break;
      }

      if (resp.data?.status !== 'INITIALIZING') {
        throw new DevopsUnexpectedStateError(`Created database is not in state 'ACTIVE' or 'INITIALIZING'`, resp)
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, options?.pollInterval ?? 2000);
      });
    }

    return mkDb(this._defaultOpts, id, config.region);
  }

  async dropDatabase(_db: Db | string): Promise<void> {
    const id = typeof _db === 'string' ? _db : _db.id;

    await this._httpClient.request({
      method: HTTP_METHODS.Post,
      path: `/databases/${id}/terminate`,
    });
  }
}

export function mkAdmin(rootOpts: RootClientOptsWithToken, options?: AdminSpawnOptions): AstraAdmin {
  return new AstraAdmin({
    ...rootOpts,
    devopsOptions: {
      ...rootOpts?.devopsOptions,
      ...options,
    },
  });
}
