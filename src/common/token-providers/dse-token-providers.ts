import { TokenProvider } from '@/src/common/token-providers/token-provider';

export class DSEUsernamePasswordTokenProvider extends TokenProvider {
  readonly #token: string;

  constructor(username: string, password: string) {
    super();
    this.#token = `cassandra:${this._encodeB64(username)}:${this._encodeB64(password)}`;
  }

  getTokenAsString(): Promise<string> {
    return Promise.resolve(this.#token);
  }

  _encodeB64(input: string) {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      return window.btoa(decodeURIComponent(encodeURIComponent(input)));
    } else if (typeof Buffer === 'function') {
      return Buffer.from(input, 'utf-8').toString('base64');
    } else {
      throw new Error('Unable to encode username/password to base64... please provide the "cassandra:[username_b64]:[password_b64]" token manually');
    }
  }
}
