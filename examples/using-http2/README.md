# astra-db-ts with HTTP/2

## Overview

> [!NOTE]  
> This example pertains to `astra-db-ts` version 2.0.0 and later.
>
> Previous versions of `astra-db-ts` only needed to manually import & set `fetch-h2` in minified & otherwise unsupported environments.
> 
> However, for the sake of compatability between CJS & ESM, and different runtime environments, coupled with the acceptable performance of `fetch`,
> `astra-db-ts 2.0` no longer has a hard dependency on `fetch-h2`, requiring the user to unconditionally provide it themselves.
>
> See the [v1.x http2-when-minified example](https://github.com/datastax/astra-db-ts/blob/v1.x/examples/http2-when-minified/README.md) for more information.

Due to the variety of runtimes & module systems offered by the JS environment, it's tricky to create a single module that
works with them all. Because `HTTP/2` doesn't natively work in all environments, `astra-db-ts` does not attempt to import
an `HTTP/2` library itself, but rather delegates the task to the user in a couple of very easy steps.

This is a simple example of how we can interact with an Astra database using HTTP/2. It will list out all the collections
in a given database. Note that Next.js is used as the example here, but the same principles applies to all other
environments as well.

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

3. Pass `fetch-h2` to the client. See [Different ways of passing in `fetch-h2`](#different-ways-of-passing-in-fetch-h2)

4. You should be able to use `@datastax/astra-db-ts` over `HTTP/2` in your project as normal now, 
   even when minified.

## Full Code Sample

```ts
import { DataAPIClient } from '@datastax/astra-db-ts';
import * as fetchH2 from 'fetch-h2';

// Creates the client with the `httpOptions` explicitly set to use our `fetchH2` client as 
// minification often conflicts with our own dynamic importing of `fetch-h2`.
const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN!, {
  httpOptions: { client: 'fetch-h2', fetchH2 },
});
const db = client.db(process.env.ASTRA_DB_ENDPOINT!);
```

## Different ways of passing in `fetch-h2`

Depending on your environment, module system, and your preferences, you may pass in `fetch-h2` in a few different ways:

#### With `import`

If you have top-level `await`:

```ts
import { DataAPIClient } from '@datastax/astra-db-ts';

const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN!, {
  httpOptions: { client: 'fetch-h2', fetchH2: await import('fetch-h2') },
});
```

Or if you'd prefer to just use normal `import`s (or aren't using ESM):

```ts
import { DataAPIClient } from '@datastax/astra-db-ts';
import * as fetchH2 from 'fetch-h2';

const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN!, {
  httpOptions: { client: 'fetch-h2', fetchH2: fetchH2 },
});
```

#### With `require`

You can use `require` inline here, if you want:

```ts
const { DataAPIClient } = require('@datastax/astra-db-ts');

const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN!, {
  httpOptions: { client: 'fetch-h2', fetchH2: require('fetch-h2') },
});
```

Or just require it at the top of your file:

```ts
const { DataAPIClient } = require('@datastax/astra-db-ts');
const fetchH2 = require('fetch-h2');

const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN!, {
  httpOptions: { client: 'fetch-h2', fetchH2: fetchH2 },
});
```
