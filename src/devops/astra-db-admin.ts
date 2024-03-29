import { AdminBlockingOptions, FullDatabaseInfo } from '@/src/devops/types';
import { DEFAULT_DEVOPS_API_ENDPOINT, DevopsApiHttpClient, HTTP_METHODS, HttpClient } from '@/src/api';
import { Db } from '@/src/data-api';
import { AdminSpawnOptions, RootClientOptsWithToken } from '@/src/client';
import { DbAdmin } from '@/src/devops/db-admin';

/**
 * An administrative class for managing Astra databases, including creating, listing, and deleting databases.
 *
 * **Shouldn't be instantiated directly; use {@link DataApiClient.admin} to obtain an instance of this class.**
 *
 * To perform admin tasks on a per-database basis, see the {@link AstraDbAdmin} class.
 *
 * @example
 * ```typescript
 * const client = new DataApiClient('token');
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
 * @see DataApiClient.admin
 * @see AstraDbAdmin
 */
export class AstraDbAdmin extends DbAdmin {
  private readonly _httpClient!: DevopsApiHttpClient;
  private readonly _db!: Db;

  /**
   * Use {@link Db.admin} or {@link AstraAdmin.dbAdmin} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(_db: Db, httpClient: HttpClient, options: AdminSpawnOptions) {
    super();

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

  /**
   * @returns the underlying `Db` object.
   */
  public override db(): Db {
    return this._db;
  }

  public async info(): Promise<FullDatabaseInfo> {
    const resp = await this._httpClient.request({
      method: HTTP_METHODS.Get,
      path: `/databases/${this._db.id}`,
    });
    return resp.data;
  }

  public override async listNamespaces(): Promise<string[]> {
    return this.info().then(i => [i.info.keyspace!, ...i.info.additionalKeyspaces ?? []].filter(Boolean))
  }

  public override async createNamespace(namespace: string, options?: AdminBlockingOptions): Promise<void> {
    await this._httpClient.request({
      method: HTTP_METHODS.Post,
      path: `/databases/${this._db.id}/keyspaces/${namespace}`,
    });
    await this._httpClient.awaitStatus(this._db, 'ACTIVE', ['MAINTENANCE'], options, 1000);
  }

  public override async dropNamespace(namespace: string, options?: AdminBlockingOptions): Promise<void> {
    await this._httpClient.request({
      method: HTTP_METHODS.Delete,
      path: `/databases/${this._db.id}/keyspaces/${namespace}`,
    });
    await this._httpClient.awaitStatus(this._db, 'ACTIVE', ['MAINTENANCE'], options, 1000);
  }

  public async drop(options?: AdminBlockingOptions): Promise<void> {
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
    ...rootOpts.adminOptions,
    ...options,
  });
}
