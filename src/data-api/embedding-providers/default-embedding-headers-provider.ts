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

import { EmbeddingHeadersProvider } from '@/src/data-api/embedding-providers';

/**
 * The most basic token provider, which simply returns the token it was instantiated with.
 *
 * Generally, anywhere this can be used in the public `astra-db-ts` interfaces, you may also pass in a plain
 * string or null/undefined, which is transformed into a {@link StaticEmbeddingHeadersProvider} under the hood.
 *
 * @example
 * ```
 * const provider = new StaticTokenProvider('token');
 * const client = new DataAPIClient(provider);
 *
 * // or just
 *
 * const client = new DataAPIClient('token');
 * ```
 *
 * @see TokenProvider
 *
 * @public
 */
export class DefaultEmbeddingHeadersProvider extends EmbeddingHeadersProvider {
  readonly #headers: Record<string, string>;

  /**
   * Constructs an instead of the {@link StaticEmbeddingHeadersProvider}.
   *
   * @param apiKey - The token to regurgitate in `getTokenAsString`
   */
  constructor(apiKey: string) {
    super();
    this.#headers = { 'x-embedding-api-key': apiKey };
  }

  /**
   * Returns the string the token provider was instantiated with.
   *
   * @returns the string the token provider was instantiated with.
   */
  override getHeaders(): Record<string, string> {
    return this.#headers;
  }
}
