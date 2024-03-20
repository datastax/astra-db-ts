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

import { DEFAULT_NAMESPACE, DevopsApiHttpClient, HTTP_METHODS, HttpClient } from '@/src/api';
import {
  CreateDatabaseAsyncOptions,
  CreateDatabaseBlockingOptions,
  CreateDatabaseOptions,
  DatabaseConfig
} from '@/src/client/types';
import { AstraDB, DevopsApiResponseError, DevopsUnexpectedStateError, replaceAstraUrlIdAndRegion } from '@/src/client';
import { AxiosError } from 'axios';
import { FullDatabaseInfo } from '@/src/client/types/admin/database-info';
import { ListDatabasesOptions } from '@/src/client/types/admin/list-databases';

export class Admin {
  private readonly _rootHttpClient: HttpClient;
  private readonly _httpClient: DevopsApiHttpClient;
  private readonly _id: string;

  constructor(httpClient: HttpClient, id: string) {
    this._rootHttpClient = httpClient;

    this._httpClient = httpClient.cloneInto(DevopsApiHttpClient, (c) => {
      c.baseUrl = 'https://api.astra.datastax.com/v2';
    });
    this._id = id;
  }

  async info(): Promise<FullDatabaseInfo> {
    try {
      const resp = await this._httpClient.request({
        method: HTTP_METHODS.get,
        path: `/databases/${this._id}`,
      });

      return resp.data;
    } catch (e) {
      if (!(e instanceof AxiosError)) {
        throw e;
      }
      throw new DevopsApiResponseError(e);
    }
  }

  async listDatabases(options?: ListDatabasesOptions): Promise<FullDatabaseInfo[]> {
    try {
      const resp = await this._httpClient.request({
        method: HTTP_METHODS.get,
        path: `/databases`,
        params: {
          include: options?.include,
          provider: options?.provider,
          limit: options?.limit,
          starting_after: options?.skip,
        },
      });

      return resp.data;
    } catch (e) {
      if (!(e instanceof AxiosError)) {
        throw e;
      }
      throw new DevopsApiResponseError(e);
    }
  }

  async createDatabase(config: DatabaseConfig, options?: CreateDatabaseAsyncOptions): Promise<string>

  async createDatabase(config: DatabaseConfig, options?: CreateDatabaseBlockingOptions): Promise<AstraDB>

  async createDatabase(config: DatabaseConfig, options?: CreateDatabaseOptions): Promise<string | AstraDB> {
    try {
      const resp = await this._httpClient.request({
        method: HTTP_METHODS.post,
        path: '/databases',
        data: config,
      });

      const id = resp.headers.location;

      if (options?.blocking === false) {
        return id;
      }

      for (;;) {
        const resp = await this._httpClient.request({
          method: HTTP_METHODS.get,
          path: `/databases/${id}`,
        });

        if (resp.data?.status === 'ACTIVE') {
          break;
        }

        if (resp.data?.status !== 'INITIALIZING') {
          // noinspection ExceptionCaughtLocallyJS
          throw new DevopsUnexpectedStateError(`Created database is not in state 'ACTIVE' or 'INITIALIZING'`, resp)
        }

        await new Promise<void>((resolve) => {
          setTimeout(resolve, options?.pollInterval ?? 2000);
        });
      }

      const newURL = replaceAstraUrlIdAndRegion(this._rootHttpClient.baseUrl, id, config.region);
      return new AstraDB(null, newURL, config.keyspace || DEFAULT_NAMESPACE, this._rootHttpClient);
    } catch (e) {
      if (!(e instanceof AxiosError)) {
        throw e;
      }
      throw new DevopsApiResponseError(e);
    }
  }

  async dropDatabase(): Promise<void> {
    try {
      await this._httpClient.request({
        method: HTTP_METHODS.post,
        path: `/databases/${this._id}/terminate`,
      });
    } catch (e) {
      if (!(e instanceof AxiosError)) {
        throw e;
      }
      throw new DevopsApiResponseError(e);
    }
  }

  async createNamespace(namespace: string): Promise<void> {
    try {
      await this._httpClient.request({
        method: HTTP_METHODS.post,
        path: `/databases/${this._id}/keyspaces/${namespace}`,
      });
    } catch (e) {
      if (!(e instanceof AxiosError)) {
        throw e;
      }
      throw new DevopsApiResponseError(e);
    }
  }

  async dropNamespace(namespace: string): Promise<void> {
    try {
      await this._httpClient.request({
        method: HTTP_METHODS.delete,
        path: `/databases/${this._id}/keyspaces/${namespace}`,
      });
    } catch (e) {
      if (!(e instanceof AxiosError)) {
        throw e;
      }
      throw new DevopsApiResponseError(e);
    }
  }
}
