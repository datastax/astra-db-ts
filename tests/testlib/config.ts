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

import * as process from 'node:process';
import dotenv from 'dotenv';
import { DataAPIEnvironments } from '@/src/lib/constants';
import { DataAPIEnvironment } from '@/src/lib';

dotenv.config();

if (process.env.USING_LOCAL_STARGATE) {
  process.env.CLIENT_DB_ENVIRONMENT = 'dse';
  process.env.CLIENT_DB_TOKEN = 'Cassandra:Y2Fzc2FuZHJh:Y2Fzc2FuZHJh';
  process.env.CLIENT_DB_URL = 'http://localhost:8181';
}

if (!process.env.CLIENT_DB_URL || !process.env.CLIENT_DB_TOKEN) {
  throw new Error('Please ensure the CLIENT_DB_URL and CLIENT_DB_TOKEN env vars are set');
}

const testHttpClient = process.env.CLIENT_TEST_HTTP_CLIENT ?? 'default:http2';

if (testHttpClient !== 'default:http2' && testHttpClient !== 'default:http1' && testHttpClient !== 'fetch') {
  throw new Error('CLIENT_TEST_HTTP_CLIENT must be one of \'default:http2\', \'default:http1\', \'fetch\', or unset to default to \'default:http2\'');
}

const environment = (process.env.CLIENT_DB_ENVIRONMENT ?? 'astra');

if (!DataAPIEnvironments.includes(<any>environment)) {
  throw new Error(`CLIENT_DB_ENVIRONMENT must be one of ${DataAPIEnvironments.map(e => `'${e}'`).join(', ')}, or unset to default to 'astra'`);
}

export const ENVIRONMENT = environment as DataAPIEnvironment;
export const TEMP_DB_NAME = 'astra-test-db-plus-random-name-1284';

export const DEFAULT_COLLECTION_NAME = 'test_coll';
export const EPHEMERAL_COLLECTION_NAME = 'temp_coll';

export const OTHER_KEYSPACE = 'other_keyspace';

export const TEST_HTTP_CLIENT = testHttpClient;

export const TEST_APPLICATION_TOKEN = process.env.CLIENT_DB_TOKEN;
export const TEST_APPLICATION_URI = process.env.CLIENT_DB_URL;
export const DEMO_APPLICATION_URI = 'https://12341234-1234-1234-1234-123412341234-us-west-2.apps.astra.datastax.com';

export const DEFAULT_TEST_TIMEOUT = +process.env.CLIENT_TESTS_TIMEOUT! || 90000;
