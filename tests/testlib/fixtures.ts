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
  ENVIRONMENT,
  OTHER_KEYSPACE,
  TEST_APPLICATION_TOKEN,
  TEST_APPLICATION_URI, TEST_HTTP_CLIENT,
} from '@/tests/testlib/config';
import { DataAPILoggingConfig } from '@/src/lib';

export interface TestObjectsOptions {
  httpClient?: typeof TEST_HTTP_CLIENT,
  env?: typeof ENVIRONMENT,
  logging?: DataAPILoggingConfig,
}

export const initTestObjects = (opts?: TestObjectsOptions) => {
  const { httpClient = TEST_HTTP_CLIENT, env = ENVIRONMENT, logging = [{ events: 'all', emits: 'event' }] } = opts ?? {};

  const preferHttp2 = httpClient === 'default:http2';
  const clientType = httpClient.split(':')[0];

  const client = new DataAPIClient(TEST_APPLICATION_TOKEN, {
    httpOptions: { preferHttp2, client: <any>clientType, maxTimeMS: 60000 },
    dbOptions: { keyspace: DEFAULT_KEYSPACE },
    environment: env,
    logging,
  });

  const db = client.db(TEST_APPLICATION_URI);

  const collection = db.collection(DEFAULT_COLLECTION_NAME);
  const collection_ = db.collection(DEFAULT_COLLECTION_NAME, { keyspace: OTHER_KEYSPACE });

  const dbAdmin = (ENVIRONMENT === 'astra')
    ? db.admin({ environment: ENVIRONMENT })
    : db.admin({ environment: ENVIRONMENT });

  return { client, db, collection, collection_, dbAdmin };
};

export const initCollectionWithFailingClient = () => {
  const { collection } = initTestObjects();
  collection['_httpClient'].executeCommand = () => { throw new Error('failing_client'); };
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
