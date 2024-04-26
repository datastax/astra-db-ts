import { context, TimeoutError } from 'fetch-h2';
import { DataAPIClientOptions } from '@/src/client';
import { buildUserAgent } from '@/src/api/clients/http-client';
import { Fetcher, RequestInfo, ResponseInfo } from '@/src/api/fetch/types';

export class FetchH2 implements Fetcher {
  readonly #context: ReturnType<typeof context>;

  constructor(options: DataAPIClientOptions | undefined, preferHttp2: boolean) {
    // Sanity check, and shuts up the type checker; should actually never happen
    if (options?.httpOptions?.client !== undefined && options?.httpOptions?.client !== 'default') {
      throw new Error('FetchH2 client tried to initialize using options for a different client type.');
    }

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

  async fetch(url: string, init: RequestInfo): Promise<ResponseInfo> {
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
