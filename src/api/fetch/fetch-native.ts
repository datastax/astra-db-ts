import { Fetcher, RequestInfo, ResponseInfo } from '@/src/api/fetch/types';

export class FetchNative implements Fetcher {
  async fetch(info: RequestInfo): Promise<ResponseInfo> {
    try {
      const init = info as RequestInit;

      const timeout = info.timeoutManager.msRemaining();

      init.keepalive = true;
      init.signal = AbortSignal.timeout(timeout);

      const resp = await fetch(info.url, init);

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
        throw info.timeoutManager.mkTimeoutError(info.url);
      }
      throw e;
    }
  }

  async disconnectAll(): Promise<void> {}
}
