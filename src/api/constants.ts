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

import { LIB_NAME, LIB_VERSION } from '@/src/version';

/**
 * @internal
 */
export const RAGSTACK_REQUESTED_WITH = (() => {
  try {
    // Do not use require() here, it will break the build in some environments such as NextJS application
    // if @datastax/ragstack-ai is not installed (which is perfectly fine).
    const ragstack = eval(`require('@datastax/ragstack-ai')`);
    const version = ragstack['RAGSTACK_VERSION'] || '?';
    return `ragstack-ai-ts/${version}`
  } catch (e) {
    return '';
  }
})();

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
 * @internal
 */
export const DEFAULT_NAMESPACE = 'default_keyspace';

/**
 * @internal
 */
export const DEFAULT_TIMEOUT = 30000;

/**
 * @internal
 */
export const DEFAULT_EMBEDDING_API_KEY_HEADER = 'x-embedding-api-key';

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
export const DEFAULT_DEVOPS_API_ENDPOINT = 'https://api.astra.datastax.com/v2';

/**
 * @internal
 */
export const DEFAULT_DATA_API_PATHS = {
  astra: 'api/json/v1',
  dse: 'v1',
  hcd: 'v1',
  cassandra: 'v1',
  other: 'v1',
};
