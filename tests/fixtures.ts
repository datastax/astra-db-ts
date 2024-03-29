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
// And now it's not even bloody needed anymore.

import { Collection, Db } from '@/src/data-api';
import { DataApiClient } from '@/src/client';
import { Context } from 'mocha';

export const DEFAULT_COLLECTION_NAME = 'test_coll';
export const EPHEMERAL_COLLECTION_NAME = 'temp_coll';
export const OTHER_NAMESPACE = 'other_keyspace';

let collCreated = false;

export const initTestObjects = async (ctx: Context, useHttp2: boolean = true): Promise<[DataApiClient, Db, Collection]> => {
  if (!process.env.ASTRA_URI || !process.env.APPLICATION_TOKEN) {
    ctx.skip();
  }

  const client = new DataApiClient(process.env.APPLICATION_TOKEN!, { dbOptions: { useHttp2 } });
  const db = client.db(process.env.ASTRA_URI!);

  const coll = (!collCreated)
    ? await db.createCollection(DEFAULT_COLLECTION_NAME, { vector: { dimension: 5, metric: 'cosine' } })
    : db.collection(DEFAULT_COLLECTION_NAME);

  collCreated = true;
  await coll.deleteAll();

  return [client, db, coll];
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

const sampleMultiLevelDoc: Employee = {
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
};

export const createSampleDocWithMultiLevel = () =>
  sampleMultiLevelDoc;

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

export const assertTestsEnabled = (ctx: Context, ...filters: ('DEV' | 'LONG' | 'ADMIN')[]) => {
  if (!filters.every(filter => process.env[`ASTRA_RUN_${filter}_TESTS`])) {
    ctx.skip();
  }
}
