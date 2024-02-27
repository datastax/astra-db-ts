import { createAstraUri, withoutFields } from '@/src/client/utils';
import { Client } from '@/src/client/client';
import { DEFAULT_KEYSPACE, HTTPClientOptions } from '@/src/api';

export interface AstraDBOptions extends Omit<HTTPClientOptions, 'applicationToken'> {
  keyspace?: string,
}

export class AstraDB extends Client {
  constructor(token: string, endpoint: string, options?: AstraDBOptions) {
    const keyspaceName = options?.keyspace || DEFAULT_KEYSPACE;

    const uri = createAstraUri(endpoint, keyspaceName);

    super(uri, keyspaceName, {
      ...withoutFields(options, 'keyspace'),
      applicationToken: token,
    });
  }
}
