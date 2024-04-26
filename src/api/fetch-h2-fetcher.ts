import { Fetcher, RequestData, ResponseData } from '@/src/api/types';
import { context, TimeoutError } from 'fetch-h2';
import { DataAPIClientOptions, FetchH2DataAPIHttpOptions } from '@/src/client';
import { buildUserAgent } from '@/src/api/http-client';

export class FetchH2Fetcher implements Fetcher {
  readonly #context: ReturnType<typeof context>;

  constructor(options: DataAPIClientOptions & { httpOptions: FetchH2DataAPIHttpOptions } | undefined, preferHttp2: boolean) {
    this.#context = context({
      userAgent: buildUserAgent(options?.caller),
      overwriteUserAgent: true,
      http1: {
        keepAlive: options?.httpOptions?.http1?.keepAlive,
        keepAliveMsecs: options?.httpOptions?.http1?.keepAliveMS,
        maxSockets: options?.httpOptions?.http1?.maxSockets,
        maxFreeSockets: options?.httpOptions?.http1?.maxFreeSockets,
      },
      httpsProtocols: (preferHttp2)
        ? undefined
        : ['http1'],
    });
  }

  async fetch(url: string, init: RequestData): Promise<ResponseData> {
    (<any>init).timeout = init.timeoutManager.msRemaining;

    try {
      const resp = await this.#context.fetch(url, init);

      return {
        headers: Object.fromEntries(resp.headers.entries()),
        body: await resp.text(),
        status: resp.status,
        url: resp.url,
        httpVersion: resp.httpVersion,
        statusText: resp.statusText,
      }
    } catch (e) {
      if (e instanceof TimeoutError) {
        throw init.timeoutManager.mkTimeoutError(url);
      }
      throw e;
    }
  }

  async disconnectAll(): Promise<void> {
    return this.#context.disconnectAll();
  }
}
