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

import { DataAPIEnvironment } from '@/src/common';
import * as process from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.CLIENT_APPLICATION_URI || !process.env.CLIENT_APPLICATION_TOKEN) {
  throw new Error('Please ensure the APPLICATION_URI and APPLICATION_TOKEN env vars are set')
}

export const ENVIRONMENT = (process.env.CLIENT_APPLICATION_ENVIRONMENT ?? 'astra') as DataAPIEnvironment;
export const TEMP_DB_NAME = 'astra-test-db-plus-random-name-1284'

export const DEFAULT_COLLECTION_NAME = 'test_coll';
export const EPHEMERAL_COLLECTION_NAME = 'temp_coll';

export const OTHER_NAMESPACE = 'other_keyspace';

export const USE_HTTP2 = !process.env.CLIENT_USE_HTTP1;
export const HTTP_CLIENT_TYPE = process.env.CLIENT_USE_FETCH ? 'fetch' : undefined;

export const TEST_APPLICATION_TOKEN = process.env.CLIENT_APPLICATION_TOKEN;
export const TEST_APPLICATION_URI = process.env.CLIENT_APPLICATION_URI;
export const DEMO_APPLICATION_URI = 'https://12341234-1234-1234-1234-123412341234-us-west-2.apps.astra.datastax.com';

export const DEFAULT_TEST_TIMEOUT = +process.env.CLIENT_TESTS_TIMEOUT! || 90000;

export const TESTS_FILTER = (() => {
  const filter = process.env.CLIENT_TESTS_FILTER;

  if (!filter) {
    return { test: () => true };
  }

  if (process.env.CLIENT_TESTS_FILTER_TYPE === 'regex') {
    const regex = RegExp(filter);

    const regexTest = (process.env.CLIENT_TESTS_FILTER_INVERTED)
      ? (name: string) => !regex.test(name)
      : regex.test.bind(regex);

    return { test: regexTest };
  }

  if (process.env.CLIENT_TESTS_FILTER_TYPE === 'match') {
    const filterTest = (process.env.CLIENT_TESTS_FILTER_INVERTED)
      ? (name: string) => !name.includes(filter)
      : (name: string) => name.includes(filter);

    return { test: filterTest };
  }

  throw new Error('If CLIENT_TESTS_FILTER is set, CLIENT_TESTS_FILTER_TYPE must be set to "regex" or "match"');
})();
