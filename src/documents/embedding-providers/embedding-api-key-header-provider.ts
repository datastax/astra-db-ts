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

import { EmbeddingHeadersProvider } from '@/src/documents/embedding-providers/embedding-headers-provider';
import { nullish } from '@/src/lib';

/**
 * The most basic embedding header provider, used for the vast majority of providers.
 *
 * Generally, anywhere this can be used in the public `astra-db-ts` interfaces, you may also pass in a plain
 * string or null/undefined, which is transformed into an {@link EmbeddingAPIKeyHeaderProvider} under the hood.
 *
 * @example
 * ```typescript
 * const provider = new EmbeddingAPIKeyHeaderProvider('api-key');
 * const collections = await db.collections('my_coll', { embeddingApiKey: provider });
 *
 * // or just
 *
 * const collections = await db.collections('my_coll', { embeddingApiKey: 'api-key' });
 * ```
 *
 * @see EmbeddingHeadersProvider
 *
 * @public
 */
export class EmbeddingAPIKeyHeaderProvider extends EmbeddingHeadersProvider {
  readonly #headers: Record<string, string>;

  /**
   * Constructs an instead of the {@link EmbeddingAPIKeyHeaderProvider}.
   *
   * @param apiKey - The api-key/token to regurgitate in `getTokenAsString`
   */
  constructor(apiKey: string | nullish) {
    super();

    this.#headers = (apiKey)
      ? { 'x-embedding-api-key': apiKey }
      : {};
  }

  /**
   * Returns the proper header for the default embedding header authentication, or an empty record if `apiKey` was undefined.
   *
   * @returns the proper header for the default embedding header authentication.
   */
  override getHeaders(): Record<string, string> {
    return this.#headers;
  }
}
