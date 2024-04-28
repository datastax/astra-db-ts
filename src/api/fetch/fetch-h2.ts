import { context, FetchInit, TimeoutError } from 'fetch-h2';
import { DataAPIClientOptions } from '@/src/client';
import { buildUserAgent } from '@/src/api/clients/http-client';
import { Fetcher, RequestInfo, ResponseInfo } from '@/src/api/fetch/types';

export class FetchH2 implements Fetcher {
  private readonly _http1: ReturnType<typeof context>;
  private readonly _preferred: ReturnType<typeof context>;

  constructor(options: DataAPIClientOptions | undefined, preferHttp2: boolean) {
    // Sanity check, and shuts up the type checker; should actually never happen
    if (options?.httpOptions?.client !== undefined && options?.httpOptions?.client !== 'default') {
      throw new Error('FetchH2 client tried to initialize using options for a different client type.');
    }

    const http1Opts = {
      userAgent: buildUserAgent(options?.caller),
      overwriteUserAgent: true,
      http1: {
        keepAlive: options?.httpOptions?.http1?.keepAlive,
        keepAliveMsecs: options?.httpOptions?.http1?.keepAliveMS,
        maxSockets: options?.httpOptions?.http1?.maxSockets,
        maxFreeSockets: options?.httpOptions?.http1?.maxFreeSockets,
      },
      httpsProtocols: <const>['http1'],
    };

    this._http1 = context(http1Opts);

    this._preferred = (preferHttp2)
      ? context({
        ...http1Opts,
        httpsProtocols: ['http2', 'http1'],
      })
      : this._http1;
  }

  async fetch(info: RequestInfo): Promise<ResponseInfo> {
    const init = info as Partial<FetchInit>;

    init.timeout = info.timeoutManager.msRemaining();

    try {
      const resp = (info.forceHttp1)
        ? await this._http1.fetch(info.url, init)
        : await this._preferred.fetch(info.url, init);

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
        throw info.timeoutManager.mkTimeoutError(info.url);
      }
      throw e;
    }
  }

  async disconnectAll(): Promise<void> {
    await this._preferred.disconnectAll();
    await this._http1.disconnectAll();
  }
}
