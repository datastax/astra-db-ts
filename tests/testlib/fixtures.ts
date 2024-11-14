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

// Changing this line of code took 6 long hours of my life.
// - import { Client } from '@/src/client/client';
// + import { Client } from '@/src/client';
// And now it's not even needed anymore :(

import { DataAPIClient } from '@/src/client';
import { DEFAULT_KEYSPACE } from '@/src/lib/api';
import {
  DEFAULT_COLLECTION_NAME,
  DEFAULT_TABLE_NAME,
  ENVIRONMENT,
  LOGGING_PRED,
  OTHER_KEYSPACE,
  TEST_APPLICATION_TOKEN,
  TEST_APPLICATION_URI,
  TEST_HTTP_CLIENT,
} from '@/tests/testlib/config';
import { DataAPIClientEvent, DataAPIClientEvents, DataAPILoggingConfig } from '@/src/lib';
import { InferTableSchema } from '@/src/db';
import * as util from 'node:util';

export interface TestObjectsOptions {
  httpClient?: typeof TEST_HTTP_CLIENT,
  env?: typeof ENVIRONMENT,
  logging?: DataAPILoggingConfig,
  isGlobal?: boolean,
}

export type EverythingTableSchema = InferTableSchema<typeof EverythingTableSchema>;

export const EverythingTableSchema = <const>{
  columns: {
    ascii: 'ascii',
    bigint: 'bigint',
    blob: 'blob',
    boolean: 'boolean',
    date: 'date',
    decimal: 'decimal',
    double: 'double',
    duration: 'duration',
    float: 'float',
    int: 'int',
    inet: 'inet',
    smallint: 'smallint',
    text: 'text',
    time: 'time',
    timestamp: 'timestamp',
    tinyint: 'tinyint',
    uuid: 'uuid',
    varint: 'varint',
    map: { type: 'map', keyType: 'text', valueType: 'uuid' },
    set: { type: 'set', valueType: 'uuid' },
    list: { type: 'list', valueType: 'uuid' },
    vector: { type: 'vector', dimension: 5 },
  },
  primaryKey: {
    partitionBy: ['text'],
    partitionSort: { int: 1 },
  },
};

export const initTestObjects = (opts?: TestObjectsOptions) => {
  const {
    httpClient = TEST_HTTP_CLIENT,
    env = ENVIRONMENT,
    logging = [{ events: 'all', emits: 'event' }],
    isGlobal = false,
  } = opts ?? {};

  const preferHttp2 = httpClient === 'default:http2';
  const clientType = httpClient.split(':')[0];

  const client = new DataAPIClient(TEST_APPLICATION_TOKEN, {
    httpOptions: { preferHttp2, client: <any>clientType, maxTimeMS: 60000 },
    dbOptions: { keyspace: DEFAULT_KEYSPACE },
    environment: env,
    logging,
  });

  for (const event of ['commandSucceeded', 'adminCommandSucceeded', 'commandFailed', 'adminCommandFailed'] as (keyof DataAPIClientEvents)[]) {
    client.on(event, (e: DataAPIClientEvent) => LOGGING_PRED(e, isGlobal) && console.log((isGlobal ? '[Global] ' : '') + util.inspect(e, { depth: null, colors: true })));
  }

  const db = client.db(TEST_APPLICATION_URI);

  const collection = db.collection(DEFAULT_COLLECTION_NAME);
  const collection_ = db.collection(DEFAULT_COLLECTION_NAME, { keyspace: OTHER_KEYSPACE });

  const table = db.table<EverythingTableSchema>(DEFAULT_TABLE_NAME);
  const table_ = db.table<EverythingTableSchema>(DEFAULT_TABLE_NAME, { keyspace: OTHER_KEYSPACE });

  const dbAdmin = (ENVIRONMENT === 'astra')
    ? db.admin({ environment: ENVIRONMENT })
    : db.admin({ environment: ENVIRONMENT });

  return { client, db, collection, collection_, dbAdmin, table, table_ };
};

export const initCollectionWithFailingClient = () => {
  const { collection } = initTestObjects();
  collection._httpClient.executeCommand = () => { throw new Error('failing_client'); };
  return collection;
};

export type Employee = {
  _id?: string;
  username?: string;
  human?: boolean;
  age?: number;
  password?: string | null;
  address?: {
    number?: number;
    street?: string | null;
    suburb?: string | null;
    city?: string | null;
    is_office?: boolean;
    country?: string | null;
  };
};

export const createSampleDocWithMultiLevel = (key: string) =>
  ({
    key,
    username: 'aaron',
    human: true,
    age: 47,
    password: null,
    address: {
      number: 86,
      street: 'monkey street',
      suburb: 'not null',
      city: 'big banana',
      is_office: false,
    },
  }) as Employee;

export const createSampleDoc2WithMultiLevel = (key: string) =>
  ({
    key,
    username: 'jimr',
    human: true,
    age: 52,
    password: 'gasxaq==',
    address: {
      number: 45,
      street: 'main street',
      suburb: null,
      city: 'nyc',
      is_office: true,
      country: 'usa',
    },
  }) as Employee;

export const createSampleDoc3WithMultiLevel = (key: string) =>
  ({
    key,
    username: 'saml',
    human: false,
    age: 25,
    password: 'jhkasfka==',
    address: {
      number: 123,
      street: 'church street',
      suburb: null,
      city: 'la',
      is_office: true,
      country: 'usa',
    },
  }) as Employee;
