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

import { StaticTokenProvider } from '@/src/lib';
import { anyInstanceOf, isNullish } from '@/src/lib/utils';
import { MonoidalOptionsHandler, OptionsHandlerOpts, Parsed } from '@/src/lib/opts-handler';
import { DecoderType, either, nullish, string } from 'decoders';


/**
 * The base class for some "token provider", a general concept for anything that provides some token to the client,
 * whether it be a static token, or if the token is dynamically fetched at runtime, or periodically refreshed.
 *
 * The {@link TokenProvider.getToken} function is called any time the token is required, whether it be
 * for the Data API, or the DevOps API.
 *
 * `astra-db-ts` provides all the main token providers you may ever need to use, but you're able to extend this
 * class to create your own if you find it necessary.
 *
 * Generally, where you can pass in a `TokenProvider`, you may also pass in a plain string which is translated
 * into a {@link StaticTokenProvider} under the hood.
 *
 * @example
 * ```typescript
 * const provider = new UsernamePasswordTokenProvider('username', 'password');
 * const client = new DataAPIClient(provider);
 * ```
 *
 * @see StaticTokenProvider
 * @see UsernamePasswordTokenProvider
 *
 * @public
 */
export abstract class TokenProvider {
  /**
   * The function which provides the token. It may do any I/O as it wishes to obtain/refresh the token, as it's called
   * every time the token is required for use, whether it be for the Data API, or the DevOps API.
   */
  abstract getToken(): string | null | undefined | Promise<string | null | undefined>;

  public static declare opts: typeof TokenProviderOptsHandler;

  /**
   * Turns a string token into a {@link StaticTokenProvider} if necessary. Throws an error if
   * it's not a string, nullish, or a `TokenProvider` already.
   *
   * Not intended for external use.
   *
   * @internal
   */
  static mergeTokens(...raw: (string | TokenProvider | null | undefined)[]): TokenProvider | undefined {
    const first = raw.find((r) => !isNullish(r));

    if (typeof first === 'string') {
      return new StaticTokenProvider(first);
    }

    if (!(<unknown>first instanceof TokenProvider) && !isNullish(first)) {
      throw new TypeError(`Expected token to be of type string | TokenProvider | nullish; got ${typeof first} (${first})`);
    }

    return first;
  };
}

class UnsetTokenProvider extends TokenProvider {
  public static INSTANCE = new UnsetTokenProvider();

  private constructor() {
    super();
  }

  getToken() {
    return undefined;
  }
}

export type ParsedTokenProvider = TokenProvider & Parsed;

interface TokenProviderOptsTypes extends OptionsHandlerOpts {
  Parsed: ParsedTokenProvider,
  Parseable: TokenProvider | string | null | undefined,
  Decoded: DecoderType<typeof tokenProvider>,
}

const tokenProvider = nullish(either(
  anyInstanceOf(TokenProvider),
  string,
));

const TokenProviderOptsHandler = new MonoidalOptionsHandler<TokenProviderOptsTypes>({
  decoder: tokenProvider,
  refine(input) {
    if (typeof input === 'string') {
      return new StaticTokenProvider(input);
    }

    if (isNullish(input)) {
      return this.empty;
    }

    return input;
  },
  concat(configs) {
    for (let i = configs.length - 1; i >= 0; i--) {
      if (configs[i] !== this.empty) {
        return configs[i];
      }
    }
    return this.empty;
  },
  empty: UnsetTokenProvider.INSTANCE,
});

TokenProvider.opts = TokenProviderOptsHandler;
