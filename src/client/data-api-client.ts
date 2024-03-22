import { Caller } from '@/src/api';
import { Db, mkDb } from '@/src/data-api/db';
import { AstraAdmin, mkAdmin } from '@/src/devops/astra-admin';

export interface DataApiClientOptions {
  logLevel?: string,
  useHttp2?: boolean,
  caller?: Caller | Caller[],
  logSkippedOptions?: boolean,
  dataApiPath?: string,
  devopsEndpoint?: string,
}

export interface DbSpawnOptions {
  namespace?: string,
  token?: string,
  logLevel?: string,
  useHttp2?: boolean,
  logSkippedOptions?: boolean,
  dataApiPath?: string,
  caller?: Caller | Caller[],
}

export interface AdminSpawnOptions {
  endpoint?: string,
  token?: string,
  logLevel?: string,
  useHttp2?: boolean,
  caller?: Caller | Caller[],
}

export class DataApiClient {
  constructor(private readonly _token: string, private readonly _options?: DataApiClientOptions) {}

  db(endpoint: string, options?: DbSpawnOptions): Db;

  db(id: string, region: string, options?: DbSpawnOptions): Db;

  db(endpointOrId: string, regionOrOptions?: string | DbSpawnOptions, maybeOptions?: DbSpawnOptions): Db {
    return mkDb(this._token, this._options, endpointOrId, regionOrOptions, maybeOptions);
  }

  admin(options?: AdminSpawnOptions): AstraAdmin {
    return mkAdmin(this._token, this._options, options);
  }
}
