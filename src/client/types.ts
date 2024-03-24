import { Caller } from '@/src/api';

export interface RootClientOptions {
  logLevel?: string,
  caller?: Caller | Caller[],
  dataApiOptions?: DbSpawnOptions,
  devopsOptions?: AdminSpawnOptions,
}

export interface RootClientOptsWithToken {
  logLevel?: string,
  caller?: Caller | Caller[],
  dataApiOptions: DbSpawnOptions & { token: string },
  devopsOptions: AdminSpawnOptions & { adminToken: string },
}

export interface DbSpawnOptions {
  token?: string,
  useHttp2?: boolean,
  namespace?: string,
  logSkippedOptions?: boolean,
  dataApiPath?: string,
}

export interface AdminSpawnOptions {
  adminToken?: string,
  endpointUrl?: string,
}
