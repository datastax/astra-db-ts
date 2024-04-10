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

export const RAG_STACK_REQUESTED_WITH = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lib = require('ragstack-ai');

    if (!lib['LIB_NAME'] || !lib['LIB_VERSION']) {
      return '';
    }
    return lib['LIB_NAME'] + '/' + lib['LIB_VERSION'];
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
export const DEFAULT_DATA_API_PATH = 'api/json/v1';
