import { TokenProvider } from '@/src/common/token-providers/token-provider';

export class StaticTokenProvider extends TokenProvider {
  readonly #token: string;

  constructor(token: string) {
    super();
    this.#token = token;
  }

  override getTokenAsString(): Promise<string> {
    return Promise.resolve(this.#token);
  }
}
