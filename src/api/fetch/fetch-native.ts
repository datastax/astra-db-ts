import { DataAPIClientOptions } from '@/src/client';
import { buildUserAgent } from '@/src/api/clients/http-client';
import { Fetcher, RequestInfo, ResponseInfo } from '@/src/api/fetch/types';

export class FetchNative implements Fetcher {
  readonly #userAgent: string;

  constructor(options: DataAPIClientOptions | undefined) {
    this.#userAgent = buildUserAgent(options?.caller);
  }

  async fetch(url: string, init: RequestInfo): Promise<ResponseInfo> {
    try {
      const timeout = init.timeoutManager.msRemaining;

      init.headers['User-Agent'] = this.#userAgent;
      init.headers['Content-Type'] = 'application/json';

      // @ts-expect-error - keepalive is fine to set here
      init.keepalive = true;

      // @ts-expect-error - signal is fine to set here
      init.signal = AbortSignal.timeout(timeout);

      const resp = await fetch(url, init);

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
    } catch (e: any) {
      if (e.name === 'TimeoutError') {
        throw init.timeoutManager.mkTimeoutError(url);
      }
      throw e;
    }
  }

  async disconnectAll(): Promise<void> {}
}
