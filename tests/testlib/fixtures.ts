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

import * as fetchH2 from 'fetch-h2';
import { DataAPIClient } from '@/src/client/index.js';
import { DEFAULT_KEYSPACE } from '@/src/lib/api/index.js';
import type { BaseClientEvent, DataAPIClientEventMap, LoggingConfig } from '@/src/lib/index.js';
import type { InferTableSchema, InferUDTSchema } from '@/src/db/index.js';
import * as util from 'node:util';
import { Table } from '@/src/documents/index.js';
import { Db } from '@/src/db/db.js';
import { memoizeRequests } from '@/tests/testlib/utils.js';
import { DEFAULT_DEVOPS_API_ENDPOINTS } from '@/src/lib/api/constants.js';
import { extractAstraEnvironment } from '@/src/administration/utils.js';
import { Cfg } from '@/tests/testlib/config.js';

export interface TestObjectsOptions {
  httpClient?: typeof Cfg.HttpClient,
  env?: typeof Cfg.DbEnvironment,
  logging?: LoggingConfig,
  isGlobal?: boolean,
}

export type EverythingTableSchema = InferTableSchema<typeof EverythingTableSchema>;
export type EverythingTableSchemaWithVectorize = InferTableSchema<typeof EverythingTableSchemaWithVectorize>;
export type ExampleUDTSchema = InferUDTSchema<typeof ExampleUDTSchema>;

export const ExampleUDTSchema = Db.userDefinedTypeSchema({
  fields: {
    name: 'text',
    age: 'varint',
    id: 'uuid',
  },
});

export const EmptyExampleUDT: ExampleUDTSchema = {
  name: null,
  age: null,
  id: null,
};

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
    map: { type: 'map', keyType: 'varint', valueType: { type: 'userDefined', udtName: 'example_udt' } },
    set: { type: 'set', valueType: 'uuid' },
    list: { type: 'list', valueType: { type: 'userDefined', udtName: 'example_udt' } },
    vector: { type: 'vector', dimension: 5 },
    udt: { type: 'userDefined', udtName: 'example_udt' },
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
    map: { type: 'map', keyType: 'varint', valueType: { type: 'userDefined', udtName: 'example_udt' } },
    set: { type: 'set', valueType: 'uuid' },
    list: { type: 'list', valueType: { type: 'userDefined', udtName: 'example_udt' } },
    vector1: { type: 'vector', dimension: Cfg.VectorizeVectorLength, service: { provider: 'openai', modelName: 'text-embedding-3-small' } },
    vector2: { type: 'vector', dimension: Cfg.VectorizeVectorLength, service: { provider: 'openai', modelName: 'text-embedding-3-small' } },
    udt: { type: 'userDefined', udtName: 'example_udt' },
  },
  primaryKey: {
    partitionBy: ['text'],
    partitionSort: { int: 1 },
  },
});

export function initTestObjects(opts?: TestObjectsOptions) {
  const {
    httpClient = Cfg.HttpClient,
    env = Cfg.DbEnvironment,
    logging = [{ events: 'all', emits: 'event' }],
    isGlobal = false,
  } = opts ?? {};

  const preferHttp2 = httpClient === 'fetch-h2:http2';
  const clientType = httpClient?.split(':')[0];

  const client = new DataAPIClient(Cfg.DbToken, {
    httpOptions: clientType ? { preferHttp2, client: <any>clientType, fetchH2 } : undefined,
    timeoutDefaults: { requestTimeoutMs: 60000 },
    dbOptions: { keyspace: DEFAULT_KEYSPACE },
    adminOptions: { endpointUrl: DEFAULT_DEVOPS_API_ENDPOINTS[(() => { try { return extractAstraEnvironment(Cfg.DbUrl); } catch (_) { return undefined!; } })()] },
    environment: env,
    logging,
  });

  for (const event of ['commandSucceeded', 'adminCommandSucceeded', 'commandFailed', 'adminCommandFailed', 'adminCommandStarted', 'adminCommandWarnings', 'adminCommandPolling'] as (keyof DataAPIClientEventMap)[]) {
    client.on(event, (e: BaseClientEvent) => Cfg.LoggingPredicate.test(e, isGlobal) && console.log((isGlobal ? '[Global] ' : '') + util.inspect(e, { depth: null, colors: true })));
  }

  const db = client.db(Cfg.DbUrl);

  const collection = db.collection(Cfg.DefaultCollectionName);
  const collection_ = db.collection(Cfg.DefaultCollectionName, {
    embeddingApiKey: Cfg.EmbeddingAPIKey,
    keyspace: Cfg.OtherKeyspace,
  });

  const table = db.table<EverythingTableSchema>(Cfg.DefaultTableName);
  const table_ = db.table<EverythingTableSchemaWithVectorize>(Cfg.DefaultTableName, {
    embeddingApiKey: Cfg.EmbeddingAPIKey,
    keyspace: Cfg.OtherKeyspace,
  });

  const dbAdmin = (Cfg.DbEnvironment === 'astra')
    ? db.admin({ environment: Cfg.DbEnvironment })
    : db.admin({ environment: Cfg.DbEnvironment });

  const admin = (Cfg.DbEnvironment === 'astra')
    ? client.admin()
    : null!;

  return { client, db, collection, collection_, dbAdmin, table, table_, admin };
}

export function initMemoizedTestObjects(opts?: TestObjectsOptions) {
  const objs = initTestObjects(opts);

  Object.values(objs)
    .filter(o => o !== null && '_httpClient' in o)
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
    username: 'jim_r',
    human: true,
    age: 52,
    password: 'has_gas==',
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
    password: 'jan_k_vans==',
    address: {
      number: 123,
      street: 'church street',
      suburb: null,
      city: 'la',
      is_office: true,
      country: 'usa',
    },
  }) as Employee;

export const DemoAstraEndpoint = 'https://12341234-1234-1234-1234-123412341234-us-west-2.apps.astra.datastax.com';
