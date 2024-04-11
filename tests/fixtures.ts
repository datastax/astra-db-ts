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

export const DEFAULT_COLLECTION_NAME = 'test_coll';
export const EPHEMERAL_COLLECTION_NAME = 'temp_coll';
export const OTHER_NAMESPACE = 'other_keyspace';

let collCreated = false;

export const USE_HTTP2 = !process.env.ASTRA_USE_HTTP1;

export const initTestObjects = async (ctx: Context, preferHttp2 = USE_HTTP2): Promise<[DataAPIClient, Db, Collection]> => {
  if (!process.env.ASTRA_URI || !process.env.APPLICATION_TOKEN) {
    ctx.skip();
  }

  const client = new DataAPIClient(process.env.APPLICATION_TOKEN!, { preferHttp2 });
  const db = client.db(process.env.ASTRA_URI!);

  const coll = (!collCreated)
    ? await (async () => {
        await db.dropCollection(EPHEMERAL_COLLECTION_NAME);
        await db.dropCollection(EPHEMERAL_COLLECTION_NAME, { namespace: OTHER_NAMESPACE });
        await db.createCollection(DEFAULT_COLLECTION_NAME, { vector: { dimension: 5, metric: 'cosine' }, checkExists: false, namespace: OTHER_NAMESPACE });
        return await db.createCollection(DEFAULT_COLLECTION_NAME, { vector: { dimension: 5, metric: 'cosine' }, checkExists: false })
      })()
    : db.collection(DEFAULT_COLLECTION_NAME);

  collCreated = true;
  await coll.deleteAll();

  return [client, db, coll];
};

export const initCollectionWithFailingClient = async (ctx: Context) => {
  const [, , collection] = await initTestObjects(ctx);
  (<any>collection['_httpClient']).executeCommand = async () => { throw new Error('test') };
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

export const assertTestsEnabled = (ctx: Context, ...filters: ('VECTORIZE' | 'LONG' | 'ADMIN' | 'DEV' | 'PROD')[]) => {
  if (filters.includes('VECTORIZE') && !process.env.ASTRA_RUN_VECTORIZE_TESTS) {
    ctx.skip();
  }

  if (filters.includes('LONG') && !process.env.ASTRA_RUN_LONG_TESTS) {
    ctx.skip();
  }

  if (filters.includes('ADMIN') && !process.env.ASTRA_RUN_ADMIN_TESTS) {
    ctx.skip();
  }

  if (filters.includes('DEV') && !(process.env.ASTRA_URI as string).includes('apps.astra-dev.datastax.com')) {
    ctx.skip();
  }

  if (filters.includes('PROD') && !(process.env.ASTRA_URI as string).includes('apps.astra.datastax.com')) {
    ctx.skip();
  }
}
