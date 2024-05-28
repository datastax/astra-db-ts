# astra-db-ts with HTTP/2 in a Minified Project

## Overview

The Data API itself does not natively support browsers, so `astra-db-ts` isn't technically supported in browsers either.

However, if, for some reason, you really want to use this in a browser, you can probably do so by installing the
`events` polyfill and setting up a [CORS proxy](https://github.com/Rob--W/cors-anywhere) to forward requests to the Data API. If no `httpOptions` are
provided, it will, by default, use the native `fetch` API (as the default `fetch-h2` isn't supported in browsers).

This is a simple example of how we can interact with an Astra database in a browser environment. It will list out
all the collections in a given database.

Do keep in mind that this is not officially supported, and may be very insecure if you're encoding sensitive
data into the browser client.

Check out the [Non-standard runtime support](../../README.md#non-standard-runtime-support) section in the main `README.md` for more information common to
non-standard runtimes.

## Getting Started

### Prerequisites:

- Ensure you have an existing Astra Database running at [astra.datastax.com](https://astra.datastax.com/).
    - You'll need an API key and a database endpoint URL to get started.

### How to Use This Example:

1. Clone this repository to your local machine.

2. Run `npm install` to install the required dependencies.

3. Copy the `.env.example` file to `.env` and fill in the required values.

4. Run `npm run dev` to start the local development server.

5. Visit `http://localhost:5173` in your browser to see the example in action.

### Steps to Start Your Own Project:

1. Create a new project as you please.

2. Install `@datastax/astra-db-ts` by running `npm i @datastax/astra-db-ts`.

3. Install the `events` polyfill (if your build tool doesn't provide polyfills) by running `npm i events`. 

4. Set up a CORS proxy to forward requests to the Data API. You can use [cors-anywhere](https://github.com/Rob--W/cors-anywhere),
   or any other CORS proxy of your choice.

5. When doing `client.db()`, prefix the endpoint URL with the CORS proxy URL as appropriate.

6. You should be able to use `@datastax/astra-db-ts` in your project as normal now.

**Please be very careful about not hard-coding credentials or sensitive data in your client-side code.**

## Full Code Sample

```ts
import { DataAPIClient } from '@datastax/astra-db-ts';

const client = new DataAPIClient(prompt('Enter your AstraDB API key: '));
const db = client.db(`${import.meta.env.CORS_PROXY_URL}${import.meta.env.ASTRA_DB_ENDPOINT}`);

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = '<p>Loading...</p>';

db.listCollections().then((collections) => {
  app.innerHTML = `<code>${JSON.stringify(collections, null, 2)}</code>`;
});
```
