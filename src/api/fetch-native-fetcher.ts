import { Fetcher, RequestData, ResponseData } from '@/src/api/types';
import { DataAPIClientOptions } from '@/src/client';
import { buildUserAgent } from '@/src/api/http-client';

export class FetchNativeFetcher implements Fetcher {
  readonly #userAgent: string;

  constructor(options: DataAPIClientOptions | undefined) {
    this.#userAgent = buildUserAgent(options?.caller);
  }

  async fetch(url: string, init: RequestData): Promise<ResponseData> {
    const timeout = init.timeoutManager.msRemaining;

    const id = setTimeout(() => {
      throw init.timeoutManager.mkTimeoutError(url);
    }, timeout);

    init.headers['User-Agent'] = this.#userAgent;
    init.headers['Content-Type'] = 'application/json';

    const resp = await fetch(url, init);

    clearTimeout(id);

    const headers = {} as Record<string, string>;
    resp.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      url: resp.url,
      statusText: resp.statusText,
      httpVersion: 1,
      headers: headers,
      body: await resp.text(),
      status: resp.status,
    }
  }

  async disconnectAll(): Promise<void> {}
}
