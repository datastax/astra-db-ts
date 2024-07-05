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

import { EmbeddingHeadersProvider } from '@/src/data-api/embedding-providers/embedding-headers-provider';

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
export class AWSEmbeddingHeadersProvider extends EmbeddingHeadersProvider {
  readonly #headers: Record<string, string>;

  /**
   * Constructs an instead of the {@link TokenProvider}.
   *
   * @param accessKeyId - The username for the DSE instance
   * @param secretAccessKey - The password for the DSE instance
   */
  constructor(accessKeyId: string, secretAccessKey: string) {
    super();
    this.#headers = {
      'x-embedding-access-id': accessKeyId,
      'x-embedding-secret-id': secretAccessKey,
    };
  }

  /**
   * Returns the token in the format `cassandra:[username_b64]:[password_b64]`
   *
   * @returns the token in the format `cassandra:[username_b64]:[password_b64]`
   */
  override getHeaders(): Record<string, string> {
    return this.#headers;
  }
}
