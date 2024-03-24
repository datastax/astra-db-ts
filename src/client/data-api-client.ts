import { Db, mkDb } from '@/src/data-api/db';
import { AstraAdmin, mkAdmin } from '@/src/devops/astra-admin';
import { AdminSpawnOptions, DbSpawnOptions, RootClientOptions, RootClientOptsWithToken } from '@/src/client/types';

export class DataApiClient {
  private readonly _options: RootClientOptsWithToken;

  constructor(token: string, options?: RootClientOptions) {
    this._options = {
      ...options,
      dataApiOptions: {
        token: token,
        ...options?.dataApiOptions,
      },
      devopsOptions: {
        adminToken: token,
        ...options?.devopsOptions,
      },
    };
  }

  db(endpoint: string, options?: DbSpawnOptions): Db;

  db(id: string, region: string, options?: DbSpawnOptions): Db;

  db(endpointOrId: string, regionOrOptions?: string | DbSpawnOptions, maybeOptions?: DbSpawnOptions): Db {
    return mkDb(this._options, endpointOrId, regionOrOptions, maybeOptions);
  }

  admin(options?: AdminSpawnOptions): AstraAdmin {
    return mkAdmin(this._options, options);
  }
}
