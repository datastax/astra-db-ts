import { DataAPIEnvironment } from '@/src/common';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.APPLICATION_URI || !process.env.APPLICATION_TOKEN) {
  throw new Error('Please ensure the APPLICATION_URI and APPLICATION_TOKEN env vars are set')
}

export const ENVIRONMENT = (process.env.APPLICATION_ENVIRONMENT ?? 'astra') as DataAPIEnvironment;
export const TEMP_DB_NAME = 'astra-test-db-plus-random-name-1284'

export const DEFAULT_COLLECTION_NAME = 'test_coll';
export const EPHEMERAL_COLLECTION_NAME = 'temp_coll';

export const OTHER_NAMESPACE = 'other_keyspace';

export const USE_HTTP2 = !process.env.ASTRA_USE_HTTP1;
export const HTTP_CLIENT_TYPE = process.env.ASTRA_USE_FETCH ? 'fetch' : undefined;

export const TEST_APPLICATION_TOKEN = process.env.APPLICATION_TOKEN;
export const TEST_APPLICATION_URI = process.env.APPLICATION_URI;
export const DEMO_APPLICATION_URI = 'https://12341234-1234-1234-1234-123412341234-us-west-2.apps.astra.datastax.com';
