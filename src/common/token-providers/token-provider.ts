import { nullish, StaticTokenProvider } from '@/src/common';

export abstract class TokenProvider {
  abstract getTokenAsString(): Promise<string>;

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
