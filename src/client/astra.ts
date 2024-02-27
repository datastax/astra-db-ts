import { withoutFields } from '@/src/client/utils';
import { Client } from '@/src/client/client';
import { DEFAULT_KEYSPACE, HTTPClientOptions } from '@/src/api';

export interface AstraDBOptions extends Omit<HTTPClientOptions, 'applicationToken'> {}

export class AstraDB extends Client {
  constructor(token: string, endpoint: string, options?: AstraDBOptions)

  constructor(token: string, endpoint: string, keyspace?: string, options?: AstraDBOptions)

  constructor(token: string, endpoint: string, keyspaceOrOptions?: AstraDBOptions | string, maybeOptions?: AstraDBOptions) {
    const keyspace = (typeof keyspaceOrOptions === 'string')
      ? keyspaceOrOptions
      : DEFAULT_KEYSPACE;

    const options = (typeof keyspaceOrOptions === 'string')
      ? maybeOptions
      : keyspaceOrOptions;

    super(endpoint, keyspace, {
      ...withoutFields(options, 'keyspace'),
      baseApiPath: options?.baseApiPath ?? 'api/json/v1',
      applicationToken: token,
    });
  }
}
