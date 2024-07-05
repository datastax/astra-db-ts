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

import { isNullish } from '@/src/common';
import { DefaultEmbeddingHeadersProvider, StaticEmbeddingHeadersProvider } from '@/src/data-api/embedding-providers';

/**
 * The base class for some "token provider", a general concept for anything that provides some token to the client,
 * whether it be a static token, or if the token is dynamically fetched at runtime, or periodically refreshed.
 *
 * The {@link EmbeddingHeadersProvider.getToken} function is called any time the token is required, whether it be
 * for the Data API, or the DevOps API.
 *
 * `astra-db-ts` provides all the main token providers you may ever need to use, but you're able to extend this
 * class to create your own if you find it necessary.
 *
 * Generally, where you can pass in a `TokenProvider`, you may also pass in a plain string which is translated
 * into a {@link StaticTokenProvider} under the hood.
 *
 * @example
 * ```
 * const provider = new UsernamePasswordTokenProvider('username', 'password');
 * const client = new DataAPIClient(provider);
 * ```
 *
 * @see StaticTokenProvider
 * @see UsernamePasswordTokenProvider
 *
 * @public
 */
export abstract class EmbeddingHeadersProvider {
  /**
   * The function which provides the token. It may do any I/O as it wishes to obtain/refresh the token, as it's called
   * every time the token is required for use, whether it be for the Data API, or the DevOps API.
   */
  abstract getHeaders(): Promise<Record<string, string>> | Record<string, string>;

  /**
   * Turns a string token into a {@link StaticTokenProvider} if necessary. Throws an error if
   * it's not a string, nullish, or a `TokenProvider` already.
   *
   * Not intended for external use.
   *
   * @internal
   */
  static parseHeaders(token: unknown): EmbeddingHeadersProvider {
    if (isNullish(token)) {
      return new StaticEmbeddingHeadersProvider({});
    }

    if (typeof token === 'string') {
      return new DefaultEmbeddingHeadersProvider(token);
    }

    if (token instanceof EmbeddingHeadersProvider) {
      return token;
    }

    throw new TypeError('Expected embeddingApiKey to be type string | EmbeddingHeadersProvider | nullish');
  }
}