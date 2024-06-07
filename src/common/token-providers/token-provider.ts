export abstract class TokenProvider {
  abstract getTokenAsString(): Promise<string>;
}
