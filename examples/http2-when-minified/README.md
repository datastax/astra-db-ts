# astra-db-ts with HTTP/2 in a Minified Project

## Overview

Due to the variety of runtimes offered by the JS environment, it's tricky to create a single module that
works with them all. Because `HTTP/2` doesn't natively work in all environments, `astra-db-ts` attempts
to dynamically require the underlying `fetch-h2` module to see if it works or not. However, this can be
problematic in minified environments, as it often breaks dynamic imports.

Most of the time, this isn't an issue, but in some cases, if you really want to use `HTTP/2` in a
non-standard or minified environment, you can manually import and pass in the `fetch-h2` module
into the `DataAPIClient` constructor.

This is a simple example of how we can interact with an Astra database using HTTP/2 in a minified
environment. It will list out all the collections in a given database. Note that Next.js is used as
the example here, but the same principles should apply to other minified environments.

Check out the [Non-standard runtime support](../../README.md#non-standard-runtime-support) section 
in the main `README.md` for more information common to non-standard runtimes.

## Getting Started

### Prerequisites:

- Ensure you have an existing Astra Database running at [astra.datastax.com](https://astra.datastax.com/).
    - You'll need an API key and a database endpoint URL to get started.

### How to Use This Example:

1. Clone this repository to your local machine.

2. Run `npm install` to install the required dependencies.

3. Copy the `.env.example` file to `.env` and fill in the required values.

4. Run `npm run dev` to start the local development server.

5. Visit `http://localhost:3000` in your browser to see the example in action.

### Steps to Start Your Own Project:

1. Create a new project as you please.

2. Install `@datastax/astra-db-ts` and `fetch-h2` by running `npm i @datastax/astra-db-ts fetch-h2`.

3. Ensure to set `httpOptions.fetchH2` to `fetchH2` in the `DataAPIClient`, where `fetchH2` is
   imported as `import * as fetchH2 from 'fetch-h2'`.

4. You should be able to use `@datastax/astra-db-ts` over `HTTP/2` in your project as normal now, 
   even when minified.

## Full Code Sample

```ts
import { DataAPIClient } from '@datastax/astra-db-ts';
import * as fetchH2 from 'fetch-h2';

// Creates the client with the `httpOptions` explicitly set to use our `fetchH2` client as 
// minification often conflicts with our own dynamic importing of `fetch-h2`.
const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN!, {
  httpOptions: { fetchH2 },
});
const db = client.db(process.env.ASTRA_DB_ENDPOINT!);
```
