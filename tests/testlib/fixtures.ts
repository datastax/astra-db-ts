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

import { DataAPIClient } from '@/src/client/index.js';
import { DEFAULT_KEYSPACE } from '@/src/lib/api/index.js';
import {
  DEFAULT_COLLECTION_NAME,
  DEFAULT_TABLE_NAME,
  ENVIRONMENT,
  LOGGING_PRED,
  OTHER_KEYSPACE,
  TEST_APPLICATION_TOKEN,
  TEST_APPLICATION_URI,
  TEST_HTTP_CLIENT, TEST_OPENAI_KEY,
} from '@/tests/testlib/config.js';
import type { BaseClientEvent, DataAPIClientEventMap, LoggingConfig } from '@/src/lib/index.js';
import type { InferTableSchema } from '@/src/db/index.js';
import * as util from 'node:util';
import { Table } from '@/src/documents/index.js';
import { memoizeRequests } from '@/tests/testlib/utils.js';

export interface TestObjectsOptions {
  httpClient?: typeof TEST_HTTP_CLIENT,
  env?: typeof ENVIRONMENT,
  logging?: LoggingConfig,
  isGlobal?: boolean,
}

export type EverythingTableSchema = InferTableSchema<typeof EverythingTableSchema>;
export type EverythingTableSchemaWithVectorize = InferTableSchema<typeof EverythingTableSchemaWithVectorize>;

export const EverythingTableSchema = Table.schema({
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
});

export const EverythingTableSchemaWithVectorize = Table.schema({
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
    vector1: { type: 'vector', dimension: 1024, service: { provider: 'openai', modelName: 'text-embedding-3-small' } },
    vector2: { type: 'vector', dimension: 1024, service: { provider: 'openai', modelName: 'text-embedding-3-small' } },
  },
  primaryKey: {
    partitionBy: ['text'],
    partitionSort: { int: 1 },
  },
});

export function initTestObjects(opts?: TestObjectsOptions) {
  const {
    httpClient = TEST_HTTP_CLIENT,
    env = ENVIRONMENT,
    logging = [{ events: 'all', emits: 'event' }],
    isGlobal = false,
  } = opts ?? {};

  const preferHttp2 = httpClient === 'fetch-h2:http2';
  const clientType = httpClient?.split(':')[0];

  const client = new DataAPIClient(TEST_APPLICATION_TOKEN, {
    httpOptions: clientType ? { preferHttp2, client: <any>clientType } : undefined,
    timeoutDefaults: { requestTimeoutMs: 60000 },
    dbOptions: { keyspace: DEFAULT_KEYSPACE },
    environment: env,
    logging,
  });

  for (const event of ['commandSucceeded', 'adminCommandSucceeded', 'commandFailed', 'adminCommandFailed'] as (keyof DataAPIClientEventMap)[]) {
    client.on(event, (e: BaseClientEvent) => LOGGING_PRED(e, isGlobal) && console.log((isGlobal ? '[Global] ' : '') + util.inspect(e, { depth: null, colors: true })));
  }

  const db = client.db(TEST_APPLICATION_URI);

  const collection = db.collection(DEFAULT_COLLECTION_NAME);
  const collection_ = db.collection(DEFAULT_COLLECTION_NAME, { keyspace: OTHER_KEYSPACE });

  const table = db.table<EverythingTableSchema>(DEFAULT_TABLE_NAME);
  const table_ = db.table<EverythingTableSchemaWithVectorize>(DEFAULT_TABLE_NAME, {
    keyspace: OTHER_KEYSPACE,
    embeddingApiKey: TEST_OPENAI_KEY,
  });

  const dbAdmin = (ENVIRONMENT === 'astra')
    ? db.admin({ environment: ENVIRONMENT })
    : db.admin({ environment: ENVIRONMENT });

  const admin = (ENVIRONMENT === 'astra')
    ? client.admin()
    : null!;

  return { client, db, collection, collection_, dbAdmin, table, table_, admin };
}

export function initMemoizedTestObjects(opts?: TestObjectsOptions) {
  const objs = initTestObjects(opts);

  Object.values(objs)
    .filter(o => '_httpClient' in o)
    .forEach(memoizeRequests);

  return objs;
}

export const initCollectionWithFailingClient = () => {
  const { collection } = initTestObjects();
  collection._httpClient.executeCommand = () => { throw new Error('failing_client'); };
  return collection;
};

export interface Employee {
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
}

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
