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
import { mkWrongTypeError } from '@/src/documents/utils.js';

/**
 * ##### Overview
 *
 * The most basic reranking header provider, used for the vast majority of providers.
 *
 * Generally, anywhere this can be used in the public `astra-db-ts` interfaces, you may also pass in a plain
 * string or null/undefined, which is transformed into an {@link RerankingAPIKeyHeaderProvider} under the hood.
 *
 * @example
 * ```typescript
 * const provider = new RerankingAPIKeyHeaderProvider('api-key');
 * const collections = await db.collections('my_coll', { rerankingApiKey: provider });
 *
 * // or just
 * const collections = await db.collections('my_coll', { rerankingApiKey: 'api-key' });
 * ```
 *
 * @see RerankingHeadersProvider
 *
 * @public
 */
export class RerankingAPIKeyHeaderProvider extends StaticHeadersProvider<'reranking'> {
  /**
   * Constructs an instead of the {@link RerankingAPIKeyHeaderProvider}.
   *
   * @param apiKey - The api-key/token to regurgitate in `getToken`
   */
  public constructor(apiKey: string | nullish) {
    const headers = (!isNullish(apiKey))
      ? { 'x-rerank-api-key': apiKey }
      : {};
    super(headers);
  }

  /**
   * Turns a string embedding api key into an `HeadersProvider<'reranking'>` if necessary.
   *
   * Throws an error if it's not a string, nullish, or a `HeadersProvider` already.
   *
   * Not intended for external use.
   *
   * @internal
   */
  public static parse(provider: unknown, field?: string): HeadersProvider<'reranking'> {
    if (typeof provider === 'string' || isNullish(provider)) {
      return new RerankingAPIKeyHeaderProvider(provider);
    }

    if (provider instanceof HeadersProvider) {
      return provider;
    }

    throw mkWrongTypeError(field ?? 'reranking api key', 'string | HeadersProvider<\'reranking\'> | nullish', provider);
  }
}
