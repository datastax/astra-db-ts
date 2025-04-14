import { Agent, RequestInit } from 'undici';
import { DataAPIClient, FetchNative, FetcherRequestInfo } from '@datastax/astra-db-ts';

// -----===-----
// INFO: This one's a basic example for Node.js users, demonstrating how you can extend the default FetchNative
// INFO: implementation to use your own custom Undici Dispatcher, to customize the HTTP client behavior.
// -----===-----

// -----===-----
// INFO: In case you didn't know, the default global fetch API implementation in Node.js is based on the
// INFO: official 'Undici' HTTP client. See: https://github.com/nodejs/undici
// -----===-----

// -----===-----
// INFO: If you are not using Node.js, or if you are polyfilling the global fetch API, then using an Undici Dispatcher may not work for you.
// INFO: See your own environment's documentation for information about customizing fetch behavior.
// -----===-----

// -----===<{ STEP 1: Create the Dispatcher }>===-----

// Here, we'll use a simple undici Agent to demonstrate how you can customize the HTTP client behavior.
// We're enabling HTTP/1.1 pipelining to improve performance, and setting some example timeouts for demonstration purposes.
const agent = new Agent({
  pipelining: 10,
  keepAliveTimeout: 10000,
  keepAliveMaxTimeout: 60000,
  connectTimeout: 5000,
});

// -----===<{ STEP 2: Extend FetchNative }>===-----

// FetchNative is the default fetch implementation used by the client. We'll extend it to use our custom agent.
class FetchNativeEx extends FetchNative {
  // We can simply override the fetch method and modify `init` to use our custom agent.
  // `init` will be passed directly to the actual fetch method, so we can modify it as needed.
  public override fetch(init: FetcherRequestInfo & RequestInit) {
    console.log('Using FetchNativeEx!');
    init.dispatcher = agent;
    return super.fetch(init);
  }
}

// -----===<{ STEP 3: Instantiate the client }>===-----

// All we have to do now is instantiate the client with our custom fetcher.
// Our dispatcher will then be used to make requests for any objects spawned from this client.
const client = new DataAPIClient({
  httpOptions: {
    client: 'custom',
    fetcher: new FetchNativeEx(),
  },
});

// Because this db was "spawned" from the client, it will use our custom dispatcher.
// If we were to create a new DataAPIClient and spawn a db from it, it would use the default FetchNative implementation.
const db = client.db(process.env.ASTRA_DB_ENDPOINT!, { token: process.env.ASTRA_DB_TOKEN });

// -----===<{ STEP 4: Profit }>===-----

// Now, under the hood, the client will use our custom dispatcher to make requests.
console.log(await db.listCollections());
