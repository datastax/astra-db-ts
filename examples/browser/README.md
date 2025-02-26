# astra-db-ts in the browser

## Overview

> [!WARNING]  
> This example pertains to `astra-db-ts` version 2.0.0 and later.
> 
> Previous versions of `astra-db-ts` need the `events` polyfill to work in the browser.
> 
> See the [v1.x browser example](https://github.com/datastax/astra-db-ts/blob/v1.x/examples/browser/README.md) for more information.

`astra-db-ts` is designed foremost as a server-side library, but it may also work in the browser if so desired.

**However, keep in mind, that doing so is insecure, and is better implemented with an actual server-side application.**

However, you may need to set up a CORS proxy (like [cors-anywhere](https://github.com/Rob--W/cors-anywhere)) to forward
requests to the Data API.

This is a simple example of how we can interact with an Astra database in a browser environment. It will list out
all the collections in a given database.

## Getting Started

### Prerequisites:

- Ensure you have an existing Astra Database running at [astra.datastax.com](https://astra.datastax.com/).
    - You'll need an API key and a database endpoint URL to get started.

### How to Use This Example:

1. Clone this repository to your local machine.

2. Run `npm install` to install the required dependencies.

3. Copy the `.env.example` file to `.env` and fill in the required values.

4. Visit https://cors-anywhere.herokuapp.com/corsdemo to temporarily enable access to the demo server.

5. Run `npm run dev` to start the local development server.

6. Visit `http://localhost:5173` in your browser to see the example in action.

### Steps to Start Your Own Project:

1. Create a new project as you please.

2. Install `@datastax/astra-db-ts` by running `npm i @datastax/astra-db-ts`.

3. Set up a CORS proxy to forward requests to the Data API. You can use something like [cors-anywhere](https://github.com/Rob--W/cors-anywhere),
   [corsproxy.io](https://corsproxy.io/), or any other CORS proxy of your choice.

4. When doing `client.db()`, prefix the endpoint URL with the CORS proxy URL as appropriate.

5. You should be able to use `@datastax/astra-db-ts` in your project as normal now.

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
