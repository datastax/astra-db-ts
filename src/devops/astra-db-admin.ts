import { FullDatabaseInfo } from '@/src/devops/types';
import { DEFAULT_DEVOPS_API_ENDPOINT, DevopsApiHttpClient, HTTP_METHODS, HttpClient } from '@/src/api';
import { ObjectId } from 'bson';
import { Db } from '@/src/data-api';
import { AdminSpawnOptions, RootClientOptsWithToken } from '@/src/client';

export class AstraDbAdmin {
  private readonly _httpClient: DevopsApiHttpClient;
  private readonly _id: string;
  private readonly _db: Db;

  constructor(_db: Db, httpClient: HttpClient, options: AdminSpawnOptions) {
    this._httpClient = httpClient.cloneInto(DevopsApiHttpClient, (c) => {
      c.baseUrl = options.endpointUrl ?? DEFAULT_DEVOPS_API_ENDPOINT;
    });

    this._id = _db.id!;
    this._db = _db;

    if (options.adminToken) {
      this._httpClient.setToken(options.adminToken);
    }
  }

  db(): Db {
    return this._db;
  }

  async info(): Promise<FullDatabaseInfo> {
    new ObjectId()
    const resp = await this._httpClient.request({
      method: HTTP_METHODS.Get,
      path: `/databases/${this._id}`,
    });
    return resp.data;
  }

  async createNamespace(namespace: string): Promise<void> {
    await this._httpClient.request({
      method: HTTP_METHODS.Post,
      path: `/databases/${this._id}/keyspaces/${namespace}`,
    });
  }

  async dropNamespace(namespace: string): Promise<void> {
    await this._httpClient.request({
      method: HTTP_METHODS.Delete,
      path: `/databases/${this._id}/keyspaces/${namespace}`,
    });
  }

  async drop(): Promise<void> {
    await this._httpClient.request({
      method: HTTP_METHODS.Delete,
      path: `/databases/${this._id}`,
    });
  }
}

export function mkDbAdmin(db: Db, httpClient: HttpClient, rootOpts: RootClientOptsWithToken, options?: AdminSpawnOptions): AstraDbAdmin {
  return new AstraDbAdmin(db, httpClient, {
    ...rootOpts.devopsOptions,
    ...options,
  });
}
