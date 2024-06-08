import { TokenProvider } from '@/src/common/token-providers/token-provider';

/**
 * The most basic token provider, which simply returns the token it was instantiated with.
 *
 * Generally, anywhere this can be used in the public `astra-db-ts` interfaces, you may also pass in a plain
 * string, which is transformed into a {@link StaticTokenProvider} under the hood.
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
export class StaticTokenProvider extends TokenProvider {
  readonly #token: string;

  /**
   * Constructs an instead of the {@link StaticTokenProvider}.
   *
   * @param token - The token to regurgitate in `getTokenAsString`
   */
  constructor(token: string) {
    super();
    this.#token = token;
  }

  /**
   * Returns the string the token provider was instantiated with.
   *
   * @returns the string the token provider was instantiated with.
   */
  override getTokenAsString(): Promise<string> {
    return Promise.resolve(this.#token);
  }
}
