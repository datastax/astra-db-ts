import { DevopsApiHttpClient } from '@/src/api/devops-api-http-client';
import { HTTP_METHODS, HttpClient } from '@/src/api';
import { HTTP1AuthHeaderFactories, HTTP1Strategy } from '@/src/api/http1';
import { CreateDatabaseOptions } from '@/src/client/types/admin/create-database';
import { AxiosError } from 'axios';
import { DevopsApiError } from '@/src/client/errors';

export class Admin {
  private readonly _rootHttpClient: HttpClient;
  private readonly _httpClient: DevopsApiHttpClient;

  constructor(httpClient: HttpClient) {
    this._rootHttpClient = httpClient;

    this._httpClient = httpClient.cloneInto(DevopsApiHttpClient, c => {
      c.baseUrl = 'https://api.astra.datastax.com/v2';
      c.requestStrategy = new HTTP1Strategy(HTTP1AuthHeaderFactories.DevopsApi);
    });
  }

  async createDatabase(config: CreateDatabaseOptions): Promise<string> {
    try {
      const resp = await this._httpClient.request({
        method: HTTP_METHODS.post,
        path: '/databases',
        data: config,
      });

      return resp.headers.location;
    } catch (e) {
      if (!(e instanceof AxiosError)) {
        throw e;
      }
      throw new DevopsApiError(e);
    }
  }
}
