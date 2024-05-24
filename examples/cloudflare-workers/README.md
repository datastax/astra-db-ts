# astra-db-ts w/ Cloudflare Workers

## Overview

`astra-db-ts` works nearly natively with the Cloudflare Workers runtime. The only detour required
to make this work is to install the `events` polyfill, which is not included natively in the
Workers runtime. Luckily, this is as simple as doing `npm i events` in your project.

This is a simple example of how it can be used to interact with an Astra database; it'll simply
list out all the collections in a given database.

Check out the [Non-standard runtime support](../../README.md#non-standard-runtime-support) section
in the main `README.md` for more information common between non-standard runtimes.

## Getting started

### Prerequisites:

- Make sure you have an existing Astra Database running @ [astra.datastax.com](https://astra.datastax.com/).
  - You'll need an API key and a database endpoint URL to get started.

### How to use this example:

1. Clone this repository to your local machine.

2. Run `npm install` to install the required dependencies.

3. Copy the `.dev.vars.example` file to `.dev.vars` and fill in the required values.

4. Run `npm run dev` to start the local development server.

5. Visit `http://localhost:8787` in your browser to see the example in action (or just press `b`).

### Steps to start your own project:

1. Use the typical `npm create cloudflare@latest` to create a new Cloudflare Workers project.

2. Install `@datastax/astra-db-ts` and `events` by running `npm i @datastax/astra-db-ts events`.

3. You should be able to use `@datastax/astra-db-ts` in your project as normal now.

## Full code sample

```ts
import { DataAPIClient } from '@datastax/astra-db-ts';

export interface Env {
  ASTRA_DB_TOKEN: string,
  ASTRA_DB_ENDPOINT: string,
}

export default {
  async fetch(_req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    // Creates the client. `astra-db-ts` can automatically infer that it should be using
    // the native `fetch` client under the hood for you.
    const client = new DataAPIClient(env.ASTRA_DB_TOKEN);
    const db = client.db(env.ASTRA_DB_ENDPOINT);

    // Simple example which (attempts to) list all the collections in the database
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
  },
};
```
