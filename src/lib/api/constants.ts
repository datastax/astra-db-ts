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

import { LIB_NAME, LIB_VERSION } from '@/src/version.js';
import type { ParsedEnvironment } from '@/src/client/opts-handlers/environment-cfg-handler.js';
import type { DataAPIEnvironment } from '@/src/lib/index.js';

/**
 * @internal
 */
export const CLIENT_USER_AGENT = LIB_NAME + '/' + LIB_VERSION;

/**
 * @internal
 */
export const HttpMethods = {
  Get: 'GET',
  Post: 'POST',
  Delete: 'DELETE',
} as const;

/**
 * The default keyspace used when no keyspace is explicitly provided on DB creation.
 *
 * @public
 */
export const DEFAULT_KEYSPACE = 'default_keyspace';

/**
 * @internal
 */
export const DEFAULT_DATA_API_AUTH_HEADER = 'Token';

/**
 * @internal
 */
export const DEFAULT_DEVOPS_API_AUTH_HEADER = 'Authorization';

/**
 * @internal
 */
export const DEFAULT_DEVOPS_API_ENDPOINTS = {
  prod: 'https://api.astra.datastax.com/v2',
  test: 'https://api.test.cloud.datastax.com/v2',
  dev: 'https://api.dev.cloud.datastax.com/v2',
};

/**
 * @internal
 */
export const DEFAULT_DATA_API_PATHS = {
  astra: 'api/json/v1',
  dse: 'v1',
  hcd: 'v1',
  cassandra: 'v1',
  other: 'v1',
} as Record<ParsedEnvironment | DataAPIEnvironment, string>;
