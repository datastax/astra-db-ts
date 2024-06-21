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

import { TokenProvider } from '@/src/common/token-providers/token-provider';

/**
 * A token provider which translates a username-password pair into the appropriate authentication token for DSE, HCD.
 *
 * Uses the format `Cassandra:b64(username):password(username)`
 *
 * @example
 * ```
 * const provider = new UsernamePasswordTokenProvider('username', 'password');
 * const client = new DataAPIClient(provider, { environment: 'dse' });
 * ```
 *
 * @see TokenProvider
 *
 * @public
 */
export class UsernamePasswordTokenProvider extends TokenProvider {
  readonly #token: string;

  /**
   * Constructs an instead of the {@link TokenProvider}.
   *
   * @param username - The username for the DSE instance
   * @param password - The password for the DSE instance
   */
  constructor(username: string, password: string) {
    super();
    this.#token = `Cassandra:${this._encodeB64(username)}:${this._encodeB64(password)}`;
  }

  /**
   * Returns the token in the format `cassandra:[username_b64]:[password_b64]`
   *
   * @returns the token in the format `cassandra:[username_b64]:[password_b64]`
   */
  override getToken(): Promise<string> {
    return Promise.resolve(this.#token);
  }

  private _encodeB64(input: string) {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      return window.btoa(input);
    } else if (typeof Buffer === 'function') {
      return Buffer.from(input, 'utf-8').toString('base64');
    } else {
      throw new Error('Unable to encode username/password to base64... please provide the "Cassandra:[username_b64]:[password_b64]" token manually');
    }
  }
}
