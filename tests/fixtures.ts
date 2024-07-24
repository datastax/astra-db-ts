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

import { Collection, Db } from '@/src/data-api';
import { DataAPIClient } from '@/src/client';
import { Context } from 'mocha';
import { DataAPIEnvironment } from '@/src/common';
import { DEFAULT_NAMESPACE } from '@/src/api';
import dotenv from 'dotenv';

dotenv.config();

export const DEFAULT_COLLECTION_NAME = 'test_coll';
export const EPHEMERAL_COLLECTION_NAME = 'temp_coll';
export const OTHER_NAMESPACE = 'other_keyspace';
export const TEMP_DB_NAME = 'astra-test-db-plus-random-name-1284'

export const USE_HTTP2 = !process.env.ASTRA_USE_HTTP1;
export const HTTP_CLIENT_TYPE = process.env.ASTRA_USE_FETCH ? 'fetch' : undefined;

if (!process.env.APPLICATION_URI || !process.env.APPLICATION_TOKEN) {
  throw new Error('Please ensure the APPLICATION_URI and APPLICATION_TOKEN env vars are set')
}

export const TEST_APPLICATION_TOKEN = process.env.APPLICATION_TOKEN;
export const TEST_APPLICATION_URI = process.env.APPLICATION_URI;
export const DEMO_APPLICATION_URI = 'https://12341234-1234-1234-1234-123412341234-us-west-2.apps.astra-dev.datastax.com';
export const ENVIRONMENT = (process.env.APPLICATION_ENVIRONMENT ?? 'astra') as DataAPIEnvironment;

export const initTestObjects = (preferHttp2 = USE_HTTP2, environment: typeof ENVIRONMENT = ENVIRONMENT): [DataAPIClient, Db, Collection] => {
  const client = new DataAPIClient(TEST_APPLICATION_TOKEN, {
    httpOptions: { preferHttp2, client: HTTP_CLIENT_TYPE },
    dbOptions: { namespace: DEFAULT_NAMESPACE },
    environment: environment,
  });

  const db = client.db(TEST_APPLICATION_URI);

  const collection = db.collection(DEFAULT_COLLECTION_NAME);

  return [client, db, collection];
};

export const initCollectionWithFailingClient = async () => {
  const [, , collection] = await initTestObjects();
  collection['_httpClient'].executeCommand = () => { throw new Error('test') };
  return collection;
}

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

export const createSampleDocWithMultiLevel = () =>
  ({
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

export const createSampleDoc2WithMultiLevel = () =>
  ({
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

export const createSampleDoc3WithMultiLevel = () =>
  ({
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

export const sampleUsersList = [
  createSampleDocWithMultiLevel(),
  createSampleDoc2WithMultiLevel(),
  createSampleDoc3WithMultiLevel(),
];

export const assertTestsEnabled = (ctx: Context, ...filters: ('VECTORIZE' | 'LONG' | 'ADMIN' | 'DEV' | 'NOT-DEV' | 'ASTRA')[]) => {
  if (filters.includes('VECTORIZE') && !process.env.ASTRA_RUN_VECTORIZE_TESTS) {
    ctx.skip();
  }

  if (filters.includes('LONG') && !process.env.ASTRA_RUN_LONG_TESTS) {
    ctx.skip();
  }

  if (filters.includes('ADMIN') && !process.env.ASTRA_RUN_ADMIN_TESTS) {
    ctx.skip();
  }

  if (filters.includes('DEV') && !TEST_APPLICATION_URI.includes('apps.astra-dev.datastax.com')) {
    ctx.skip();
  }

  if (filters.includes('NOT-DEV') && TEST_APPLICATION_URI.includes('apps.astra-dev.datastax.com')) {
    ctx.skip();
  }

  if (filters.includes('ASTRA') && !TEST_APPLICATION_URI.includes('datastax.com')) {
    ctx.skip();
  }
}
