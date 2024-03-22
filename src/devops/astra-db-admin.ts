import { FullDatabaseInfo } from '@/src/data-api/types';
import { DevopsApiHttpClient, HTTP_METHODS, HttpClient } from '@/src/api';
import { ObjectId } from 'bson';
import { Db } from '@/src/data-api';

export class AstraDbAdmin {
  private readonly _httpClient: DevopsApiHttpClient;
  private readonly _id: string;
  private readonly _db: Db;

  constructor(_db: Db, httpClient: HttpClient) {
    this._httpClient = httpClient.cloneInto(DevopsApiHttpClient, (c) => {
      c.baseUrl = 'https://api.astra.datastax.com/v2';
    });
    this._id = _db.id!;
    this._db = _db;
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
