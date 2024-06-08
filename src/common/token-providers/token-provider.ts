import { nullish, StaticTokenProvider } from '@/src/common';

/**
 * The base class for some "token provider", a general concept for anything that provides some token to the client,
 * whether it be a static token, or if the token is dynamically fetched at runtime, or periodically refreshed.
 *
 * The {@link TokenProvider.getTokenAsString} function is called any time the token is required, whether it be
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
 * const provider = new DSEUsernamePasswordTokenProvider('username', 'password');
 * const client = new DataAPIClient(provider);
 * ```
 *
 * @see StaticTokenProvider
 * @see DSEUsernamePasswordTokenProvider
 *
 * @public
 */
export abstract class TokenProvider {
  /**
   * The function which provides the token. It may do any I/O as it wishes to obtain/refresh the token, as it's called
   * every time the token is required for use, whether it be for the Data API, or the DevOps API.
   */
  abstract getTokenAsString(): Promise<string>;

  /**
   * Turns a string token into a {@link StaticTokenProvider} if necessary. Throws an error if
   * it's not a string, nullish, or a `TokenProvider` already.
   *
   * Not intended for external use.
   *
   * @internal
   */
  static parseToken(token: unknown): TokenProvider | nullish {
    if (typeof token === 'string') {
      return new StaticTokenProvider(token);
    }

    if (token instanceof TokenProvider || token === null || token === undefined) {
      return token;
    }

    throw new TypeError('Expected token to be type string | TokenProvider');
  }
}
