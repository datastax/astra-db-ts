// -----===-----
// INFO: If you're in an environment without a global fetch API, you can use a polyfill to provide one.
// INFO: This example demonstrates how to use 'node-fetch' as a polyfill for the global fetch API.
// INFO:
// INFO: If you're on the browser, you can use 'whatwg-fetch' instead.
// INFO: See https://github.com/BuilderIO/this-package-uses-fetch
// -----===-----

// -----===<{ STEP 1: Polyfill fetch }>===-----

// astra-db-ts may be imported before 'node-fetch', but it is necessary that `fetch` is polyfilled BEFORE a DataAPIClient is instantiated.
import fetch from 'node-fetch';

// Depending on your needs, you may want to (or need to) declare `fetch` as part of the global scope:
//
// declare global {
//   const fetch: typeof import('node-fetch');
// }

// Also, depending on your setup, you may or may not need to cast `globalThis` to `any` before assigning `fetch`.
(globalThis as any).fetch = fetch;

// -----===<{ STEP 2: Use @datastax/astra-db-ts like normal }>===-----

// And that's really it. Now that we've polyfilled fetch, we can use astra-db-ts as usual.
import { DataAPIClient } from '@datastax/astra-db-ts';

const client = new DataAPIClient();
const db = client.db(process.env.ASTRA_DB_ENDPOINT!, { token: process.env.ASTRA_DB_TOKEN });

console.log(await db.listCollections());
