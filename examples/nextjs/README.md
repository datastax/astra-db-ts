# astra-db-ts w/ Next.js

## Overview

`astra-db-ts` works natively with Next.js. Just some minor special action is necessary if you need to use
HTTP/2. See `examples/http2-when-minified` for more information about using HTTP/2 with Next.js.

This is a simple example of how it can be used to interact with an Astra database; it'll simply 
list out all the collections in a given database.

Check out the [Non-standard environment support](../../README.md#non-standard-environment-support) section
in the main `README.md` for more information common between non-standard environments.

## Getting started

### Prerequisites:

- Make sure you have an existing Astra Database running @ [astra.datastax.com](https://astra.datastax.com/).
    - You'll need an API key and a database endpoint URL to get started.

### How to use this example:

1. Clone this repository to your local machine.

2. Run `npm install` to install the required dependencies.

3. Copy the `.env.example` file to `.env` and fill in the required values.

4. Run `npm run dev` to start the local development server.

5. Visit `http://localhost:3000` in your browser to see the example in action.

### Steps to start your own project:

1. Use the typical `npx create-next-app@latest` to create a new Next.js project.

2. Install `@datastax/astra-db-ts` by running `npm i @datastax/astra-db-ts`.

3. If you're using the (default) `nodejs` runtime, be sure to set `httpOptions.client` to `'fetch'`
   in the `DataAPIClient`

4. You should be able to use `@datastax/astra-db-ts` in your project as normal now.

## Full code sample

```ts
import { DataAPIClient } from '@datastax/astra-db-ts';

// Creates the client with the `httpOptions` set to use the `fetch` client as next.js's minification
// conflicts with the importing of our default http client (see http2-when-minified for more info)
const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN!, {
  httpOptions: { client: 'fetch' },
});
const db = client.db(process.env.ASTRA_DB_ENDPOINT!);

// If `runtime` is set to `edge`, you could get away without needing to specify the specific
// client, as `astra-db-ts` would be able to infer that it should use `fetch` for you.
// e.g. `const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN!);`
// export const runtime = 'edge';

// Simple example which (attempts to) list all the collections in the database
export async function GET(_: Request) {
  try {
    const collections = await db.listCollections();

    return new Response(JSON.stringify(collections), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}
```
