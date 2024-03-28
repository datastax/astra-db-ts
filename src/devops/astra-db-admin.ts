import { AdminBlockingOptions, FullDatabaseInfo } from '@/src/devops/types';
import { DEFAULT_DEVOPS_API_ENDPOINT, DevopsApiHttpClient, HTTP_METHODS, HttpClient } from '@/src/api';
import { Db } from '@/src/data-api';
import { AdminSpawnOptions, RootClientOptsWithToken } from '@/src/client';
import { DevopsUnexpectedStateError } from '@/src/devops/errors';

export class AstraDbAdmin {
  private readonly _httpClient!: DevopsApiHttpClient;
  private readonly _db!: Db;

  constructor(_db: Db, httpClient: HttpClient, options: AdminSpawnOptions) {
    Object.defineProperty(this, '_httpClient', {
      value: httpClient.cloneInto(DevopsApiHttpClient, (c) => {
        c.baseUrl = options.endpointUrl ?? DEFAULT_DEVOPS_API_ENDPOINT;
      }),
      enumerable: false,
    });

    Object.defineProperty(this, '_db', {
      value: _db,
      enumerable: false,
    });

    if (options.adminToken) {
      this._httpClient.setToken(options.adminToken);
    }
  }

  db(): Db {
    return this._db;
  }

  async info(): Promise<FullDatabaseInfo> {
    const resp = await this._httpClient.request({
      method: HTTP_METHODS.Get,
      path: `/databases/${this._db.id}`,
    });
    return resp.data;
  }

  async listNamespaces(): Promise<string[]> {
    return this.info().then(i => [i.info.keyspace!, ...i.info.additionalKeyspaces ?? []].filter(Boolean))
  }

  async createNamespace(namespace: string, options?: AdminBlockingOptions): Promise<void> {
    await this._httpClient.request({
      method: HTTP_METHODS.Post,
      path: `/databases/${this._db.id}/keyspaces/${namespace}`,
    });
    await this._httpClient.awaitStatus(this._db, 'ACTIVE', ['MAINTENANCE'], options, 1000);
  }

  async dropNamespace(namespace: string, options?: AdminBlockingOptions): Promise<void> {
    await this._httpClient.request({
      method: HTTP_METHODS.Delete,
      path: `/databases/${this._db.id}/keyspaces/${namespace}`,
    });
    await this._httpClient.awaitStatus(this._db, 'ACTIVE', ['MAINTENANCE'], options, 1000);
  }

  async drop(options?: AdminBlockingOptions): Promise<void> {
    await this._httpClient.request({
      method: HTTP_METHODS.Post,
      path: `/databases/${this._db.id}/terminate`,
    });
    await this._httpClient.awaitStatus(this._db, 'TERMINATED', ['TERMINATING'], options, 10000);
  }
}

/**
 * @internal
 */
export function mkDbAdmin(db: Db, httpClient: HttpClient, rootOpts: RootClientOptsWithToken, options?: AdminSpawnOptions): AstraDbAdmin {
  return new AstraDbAdmin(db, httpClient, {
    ...rootOpts.devopsOptions,
    ...options,
  });
}
