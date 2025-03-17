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

import { EmbeddingAPIKeyHeaderProvider } from '@/src/documents/index.js';
import { isNullish } from '@/src/lib/utils.js';
import { HeadersProvider } from '@/src/lib/headers-providers/root/headers-provider.js';

/**
 * The base class for an "embedding headers provider", a general concept for anything that provides headers used for
 * vectorize operations on a per-call basis, whether the headers be static, dynamically fetched at runtime, or
 * periodically refreshed/cycled.
 *
 * The {@link EmbeddingHeadersProvider.getHeaders} function is called for every request to the Data API, regardless
 * of if vectorize is being utilized or not. Note that this is called for every individual request on multipart
 * operations, such as insertMany or find.
 *
 * `astra-db-ts` provides all the main embedding headers providers you may ever need to use, but you're able to extend
 * this class to create your own if you find it necessary.
 *
 * Generally, where you can pass in a `EmbeddingHeadersProvider`, you may also pass in a plain string which is
 * translated into an {@link EmbeddingAPIKeyHeaderProvider} under the hood.
 *
 * @example
 * ```typescript
 * // Using explicit `EmbeddingHeadersProvider`
 * const provider = new AWSEmbeddingHeadersProvider('access-key-id', 'secret-access-key');
 * const coll1 = await db.collections('my_coll1', { embeddingApiKey: provider });
 *
 * // Implicitly converted to `EmbeddingAPIKeyHeaderProvider`
 * const coll2 = await db.collections('my_coll2', { embeddingApiKey: 'sk-...' });
 * ```
 *
 * @see EmbeddingAPIKeyHeaderProvider
 * @see AWSEmbeddingHeadersProvider
 *
 * @public
 */
export abstract class EmbeddingHeadersProvider extends HeadersProvider {
  /**
   * The function which provides the headers.
   *
   * It may do any I/O as it wishes to obtain/refresh the token, as it's called for every request to the Data API.
   *
   * If no promise is returned, it will not be awaited (no minor performance impact).
   */
  abstract getHeaders(): Promise<Record<string, string>> | Record<string, string>;

  /**
   * Turns a string embedding api key into an {@link EmbeddingAPIKeyHeaderProvider} if necessary. Throws an error if
   * it's not a string, nullish, or a `EmbeddingHeadersProvider` already.
   *
   * Not intended for external use.
   *
   * @internal
   */
  static parse(provider: unknown): EmbeddingHeadersProvider {
    if (typeof provider === 'string' || isNullish(provider)) {
      return new EmbeddingAPIKeyHeaderProvider(provider);
    }

    if (provider instanceof EmbeddingHeadersProvider) {
      return provider;
    }

    throw new TypeError('Expected embeddingApiKey to be type string | EmbeddingHeadersProvider | nullish');
  }
}
