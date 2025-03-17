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

import { forJSEnv } from '@/src/lib/utils.js';
import { StaticTokenProvider } from '@/src/lib/headers-providers/impls/token/static-token-provider.js';

/**
 * A token provider which translates a username-password pair into the appropriate authentication token for DSE, HCD.
 *
 * Uses the format `Cassandra:b64(username):password(username)`
 *
 * @example
 * ```typescript
 * const provider = new UsernamePasswordTokenProvider('username', 'password');
 * const client = new DataAPIClient(provider, { environment: 'dse' });
 * ```
 *
 * @see TokenProvider
 *
 * @public
 */
export class UsernamePasswordTokenProvider extends StaticTokenProvider {
  /**
   * Constructs an instead of the {@link TokenProvider}.
   *
   * @param username - The username for the DSE instance
   * @param password - The password for the DSE instance
   */
  constructor(username: string, password: string) {
    super(`Cassandra:${encodeB64(username)}:${encodeB64(password)}`);
  }
}

const encodeB64 = forJSEnv<[string], string>({
  server: (input) => {
    return Buffer.from(input, 'utf-8').toString('base64');
  },
  browser: (input) => {
    return window.btoa(input);
  },
  unknown: () => {
    throw new Error('Unable to encode username/password to base64... please provide the "Cassandra:[username_b64]:[password_b64]" token manually');
  },
});
