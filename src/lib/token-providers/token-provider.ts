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

import type { GetHeadersCtx} from '@/src/lib/index.js';
import { HeadersProvider, StaticTokenProvider } from '@/src/lib/index.js';
import { anyInstanceOf, findLast, isNullish } from '@/src/lib/utils.js';
import type { Monoid, OptionsHandlerTypes, Parsed } from '@/src/lib/opts-handlers.js';
import { MonoidalOptionsHandler } from '@/src/lib/opts-handlers.js';
import type { DecoderType} from 'decoders';
import { either, nullish, string } from 'decoders';
import { DEFAULT_DATA_API_AUTH_HEADER, DEFAULT_DEVOPS_API_AUTH_HEADER } from '@/src/lib/api/constants.js';
import type { ParsedHeadersProviders } from '@/src/lib/headers-providers/root/opts-handlers.js';

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
   * @internal
   */
  public static opts: typeof TokenProviderOptsHandler;

  /**
   * The function which provides the token. It may do any I/O as it wishes to obtain/refresh the token, as it's called
   * every time the token is required for use, whether it be for the Data API, or the DevOps API.
   */
  public abstract getToken(): string | null | undefined | Promise<string | null | undefined>;

  /**
   * @internal
   */
  public toHeadersProvider(): ParsedHeadersProviders {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- necessary in this case
    const tp = this;

    const hp = new (class extends HeadersProvider {
      getHeaders(ctx: GetHeadersCtx) {
        const maybePromise = tp.getToken();

        return (maybePromise instanceof Promise)
          ? maybePromise.then(tp._mkAuthHeader(ctx))
          : tp._mkAuthHeader(ctx)(maybePromise);
      }
    })();

    return HeadersProvider.opts.fromObj.parse(hp);
  }

  /**
   * @internal
   */
  protected _mkAuthHeader(ctx: GetHeadersCtx) {
    return (token: string | null | undefined) =>
      (token)
        ? (ctx.for === 'data-api')
          ? { [DEFAULT_DATA_API_AUTH_HEADER]: token }
          : { [DEFAULT_DEVOPS_API_AUTH_HEADER]: `Bearer ${token}` }
        : {};
  }
}

/**
 * @internal
 */
class UnsetTokenProvider extends TokenProvider {
  public static INSTANCE = new UnsetTokenProvider();

  private constructor() {
    super();
  }

  getToken() {
    return undefined;
  }
}

/**
 * @internal
 */
interface Types extends OptionsHandlerTypes {
  Parsed: ParsedTokenProvider,
  Parseable: TokenProvider | string | undefined | null,
  Decoded: DecoderType<typeof decoder>,
}

/**
 * @internal
 */
export type ParsedTokenProvider = TokenProvider & Parsed<'TokenProvider'>;

/**
 * @internal
 */
const monoid: Monoid<TokenProvider> = {
  empty: UnsetTokenProvider.INSTANCE,
  concat: findLast<TokenProvider>((a) => a !== UnsetTokenProvider.INSTANCE, UnsetTokenProvider.INSTANCE),
};

/**
 * @internal
 */
const decoder = nullish(either(
  anyInstanceOf(TokenProvider),
  string,
));

/**
 * @internal
 */
const transformed = decoder.transform((input) => {
  if (typeof input === 'string') {
    return new StaticTokenProvider(input);
  }

  if (isNullish(input)) {
    return UnsetTokenProvider.INSTANCE;
  }

  return input;
});

/**
 * @internal
 */
const TokenProviderOptsHandler = new MonoidalOptionsHandler<Types>(transformed, monoid);
TokenProvider.opts = TokenProviderOptsHandler;
