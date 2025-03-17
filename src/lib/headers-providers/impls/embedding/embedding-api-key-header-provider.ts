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

import type { nullish } from '@/src/lib/index.js';
import { HeadersProvider, StaticHeadersProvider } from '@/src/lib/headers-providers/index.js';
import { isNullish } from '@/src/lib/utils.js';

/**
 * ##### Overview
 *
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
 * const collections = await db.collections('my_coll', { embeddingApiKey: 'api-key' });
 * ```
 *
 * @see EmbeddingHeadersProvider
 *
 * @public
 */
export class EmbeddingAPIKeyHeaderProvider extends StaticHeadersProvider<'embedding'> {
  /**
   * Constructs an instead of the {@link EmbeddingAPIKeyHeaderProvider}.
   *
   * @param apiKey - The api-key/token to regurgitate in `getToken`
   */
  public constructor(apiKey: string | nullish) {
    const headers = (apiKey)
      ? { 'x-embedding-api-key': apiKey }
      : {};
    super(headers);
  }

  /**
   * Turns a string embedding api key into a `HeadersProvider<'embedding'>` if necessary.
   *
   * Throws an error if it's not a string, nullish, or a `HeadersProvider` already.
   *
   * Not intended for external use.
   *
   * @internal
   */
  public static parse(provider: unknown, field?: string): HeadersProvider<'embedding'> {
    if (typeof provider === 'string' || isNullish(provider)) {
      return new EmbeddingAPIKeyHeaderProvider(provider);
    }

    if (provider instanceof HeadersProvider) {
      return provider;
    }

    throw new TypeError(`Expected ${field ?? 'embedding api key'} to be type string | EmbeddingHeadersProvider | nullish`);
  }
}
