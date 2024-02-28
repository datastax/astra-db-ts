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

    if (!keyspace.match(/^[a-zA-Z0-9_]{1,48}$/)) {
      throw new Error('Invalid keyspace format; either pass a valid keyspace name, or don\t pass it at all to use the default keyspace');
    }

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
