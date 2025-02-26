import { DataAPIClient, Fetcher, FetcherRequestInfo, FetcherResponseInfo } from '@datastax/astra-db-ts';
import * as https from 'node:https';
import axios, { AxiosHeaders, AxiosInstance } from 'axios';

// -----===-----
// INFO: This is an example, completely custom fetcher implementation based on Axios
// INFO: Of course, the same principles can be applied to any other HTTP client library you may want to use.
// -----===-----

// -----===-----
// WARNING: This is NOT an official DataStax `astra-db-ts` Fetcher implementation.
// WARNING: Use at your own risk; test and validate thoroughly before using in production.
// -----===-----

// -----===<{ STEP 1: Create your Fetcher }>===-----

// You can technically use a POJO (Plain Old JavaScript Object) as well, but we'll use a class here.
export class AxiosFetcher implements Fetcher {
  // We'll use a custom axios instance to demonstrate how you can customize the HTTP client behavior.
  private readonly _axiosInstance: AxiosInstance;

  constructor() {
    // Because we're using Node.js, we can take advantage of the built-in https.Agent to manage connections.
    // Depending on your environment, you'll have different axios configuration options available.
    const agent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
    });

    // We'll ensure that `validateStatus` always returns `true` so that errors aren't thrown for non-2xx responses,
    // as `astra-db-ts` needs to handle all responses uniformly.
    this._axiosInstance = axios.create({
      httpsAgent: agent,
      validateStatus: () => true,
    });
  }

  public async fetch(init: FetcherRequestInfo): Promise<FetcherResponseInfo> {
    console.log('Using AxiosFetcher!');

    try {
      // We can make the actual request as usual here, using the axios instance we created.
      // We'll set the responseType to 'text' to ensure that the body is always a string.
      const resp = await this._axiosInstance.request({
        url: init.url,
        method: init.method,
        headers: init.headers,
        data: init.body,
        timeout: init.timeout,
        responseType: 'text',
      });

      // We need to normalize the headers so it's a POJO instead of an AxiosHeaders object.
      const headers: Record<string, string> = {};

      // Unfortunately, the `AxiosResponse['headers']` type is rather convoluted, so we'll need to check for its correct
      // type, and ignore the incorrect LSP error (SuspiciousTypeOfGuard), as it is necessary in this case.
      // noinspection SuspiciousTypeOfGuard
      const iterator = (resp.headers instanceof AxiosHeaders)
        ? resp.headers
        : Object.entries(resp.headers);

      for (const [key, value] of iterator) {
        headers[key] = String(value);
      }

      // We'll then return the response in the format expected by the client.
      return {
        url: resp.config.url || init.url,
        statusText: resp.statusText,
        httpVersion: 1,
        headers: headers,
        body: resp.data,
        status: resp.status,
      };
    } catch (e) {
      // We need to explicitly handle timeout errors, and rethrow them as the timeout error that the client provides.
      if (axios.isAxiosError(e)) {
        if (e.code === 'ECONNABORTED') {
          throw init.mkTimeoutError();
        }
        throw e.cause || e;
      }
      throw e;
    }
  }

  // We'll destroy the agent when the client is closed (since keepAlive is enabled),
  // to ensure that all connections are properly closed.
  public async close(): Promise<void> {
    (this._axiosInstance.defaults.httpsAgent as https.Agent).destroy();
  }
}

// -----===<{ STEP 2: Instantiate the client }>===-----

// All we have to do now is instantiate the client with our custom fetcher.
// Our dispatcher will then be used to make requests for any objects spawned from this client.
const client = new DataAPIClient({
  httpOptions: {
    client: 'custom',
    fetcher: new AxiosFetcher(),
  },
});

// Because this db was "spawned" from the client, it will use our custom dispatcher.
// If we were to create a new DataAPIClient and spawn a db from it, it would use the default FetchNative implementation.
const db = client.db(process.env.ASTRA_DB_ENDPOINT!, { token: process.env.ASTRA_DB_TOKEN });

// -----===<{ STEP 3: Profit }>===-----

// Now, under the hood, the client will use our custom fetcher to make requests.
console.log(await db.listCollections());
