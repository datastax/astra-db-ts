import { TokenProvider } from '@/src/common/token-providers/token-provider';

export class StaticTokenProvider extends TokenProvider {
  readonly #token: string;

  constructor(token: string) {
    super();
    this.#token = token;
  }

  getTokenAsString(): Promise<string> {
    return Promise.resolve(this.#token);
  }

  static fromMaybeString(token: string | TokenProvider | undefined): TokenProvider | undefined {
    return (typeof token === 'string')
      ? new StaticTokenProvider(token)
      : token;
  }
}
