# @datastax/astra-db-ts

`astra-db-ts` is a TypeScript client for interacting with [DataStax Astra DB](https://astra.datastax.com/signup).

> **Warning**
> This README is still under construction; parts of it may be incomplete or outdated.

*This README targets v2.0.0+, which introduces a whole new API. Click [here](https://github.com/datastax/astra-db-ts/tree/v1.x?tab=readme-ov-file#datastaxastra-db-ts) for the pre-existing client readme.*

## Table of contents
- [Quickstart](#quickstart)
  - [Collections](#collections)
  - [Tables](#tables)
- [High-level architecture](#high-level-architecture)
- [Getting the most out of the typing](#getting-the-most-out-of-the-typing)
- [Working with Dates](#working-with-dates)
- [Working with ObjectIds and UUIDs](#working-with-objectids-and-uuids)
- [Monitoring/logging](#monitoringlogging)
- [Non-astra support](#non-astra-support)
- [Non-standard environment support](#non-standard-environment-support)
  - [HTTP/2 with minification](#http2-with-minification)
  - [Browser support](#browser-support)

## Quickstart

Use your preferred package manager to install `@datastax/astra-db-ts`. Note that this is not supported in browsers.

Get the *API endpoint* and your *application token* for your Astra DB instance @ [astra.datastax.com](https://astra.datastax.com).

### Collections

```typescript
import { DataAPIClient, ObjectId, vector, VectorDoc, oid } from '@datastax/astra-db-ts';

// Connect to the db
const client = new DataAPIClient({ logging: 'all' });
const db = client.db(process.env.CLIENT_DB_URL!, { token: process.env.CLIENT_DB_TOKEN! });

// The `VectorDoc` interface adds `$vector?: DataAPIVector` as a field to the collection type
interface Dream extends VectorDoc {
  _id: ObjectId,   // Uses an `astra-db-ts` provided type here (NOT the `bson` version)
  summary: string,
  tags?: string[], // No sets/maps available without creating custom ser/des rules
}

(async () => {
  // Create the table using our helper function.
  // The _id should be an `ObjectId` type, as specified by `defaultId.type`
  const collection = await db.createCollection<Dream>('dreams', {
    defaultId: { type: 'objectId' },
  });

  // Batch-insert some rows into the table
  // _id can be optionally provided, or be auto-generated @ the server side
  await collection.insertMany([{
    summary: 'A dinner on the Moon',
    $vector: vector([0.2, -0.3, -0.5]),   // Shorthand for `new DataAPIVector([0.2, -0.3, -0.5])`
  }, {
    summary: 'Riding the waves',
    $vector: vector([0, 0.2, 1]),
    tags: ['sport'],
  }, {
    _id: oid('674f0f5c1c162131319fa09e'), // Shorthand for `new ObjectId('674f0f5c1c162131319fa09e')`
    summary: 'Meeting Beethoven at the dentist',
    $vector: vector([0.2, 0.6, 0]),
  }]);

  // Hm, changed my mind
  await collection.updateOne({ id: 103 }, { $set: { summary: 'Surfers\' paradise' } });

  // Let's see what we've got
  const cursor = collection.find({})
          .sort({ vector: vector([0, 0.2, 0.4]) }) // Performing a vector search
          .includeSimilarity(true)                 // The found doc is inferred to have `$similarity` as a property now
          .limit(2);

  // This would print:
  // - Surfers' paradise: 0.98238194
  // - Friendly aliens in town: 0.91873914
  for await (const result of cursor) {
    console.log(`${result.summary}: ${result.$similarity}`);
  }

  // Cleanup (if desired)
  await collection.drop();
})();
```

### Tables

```typescript
import { DataAPIClient, InferTableSchema, vector } from '@datastax/astra-db-ts';

// Connect to the db
const client = new DataAPIClient({ logging: 'all' });
const db = client.db(process.env.CLIENT_DB_URL!, { token: process.env.CLIENT_DB_TOKEN! });

// Create a table through the Data API if it does not yet exist.
// Returns the created table through a function so we can use the inferred type of the table ourselves
// (instead of having to manually define it)
const mkDreamsTable = async () => await db.createTable('dreams', {
  definition: {
    columns: {
      id: 'int',                                // Shorthand notation for { type: 'int' }
      summary: 'text',
      tags: { type: 'set', valueType: 'text' }, // Collection types require additional type information
      vector: { type: 'vector', dimension: 3 }, // Auto-embedding-generation can be enabled through a `service` block
    },
    primaryKey: 'id',                           // Shorthand for { partitionBy: ['id'] }
  },
  ifNotExists: true,                            // If any table with the same name exists, do nothing
});                                             // (note that this does not check if the tables are the same)

// Infer the TS-equivalent type from the table definition (like zod or arktype). Equivalent to:
//
// interface TableSchema extends Row<'id'> {
//   id: number,                     --  A primary key component, so it's required
//   summary?: string | null,        --  Not a primary key, so it's optional and may return as null when found
//   tags?: Set<string>,             --  Sets/maps/lists are optional to insert, but will actually be returned as empty collections instead of null
//   vector?: DataAPIVector | null,  --  Vectors, however, may be null.
// }
type Dream = InferTableSchema<typeof mkDreamsTable>;

(async () => {
  // Create the table using our helper function.
  // Table will be typed as `Table<Dream, { id: number }>`, where the former is the schema, and the latter is the primary key
  const table = await mkDreamsTable();

  // Enables vector search on the table (on the 'vector' column)
  await table.createVectorIndex('dreams_vector_idx', 'vector', {
    options: { metric: 'cosine' },
    ifNotExists: true,
  });

  // Batch-insert some rows into the table
  const rows: Dream[] = [{
    id: 102,
    summary: 'A dinner on the Moon',
    vector: vector([0.2, -0.3, -0.5]), // Shorthand for `new DataAPIVector([0.2, -0.3, -0.5])`
  }, {
    id: 103,
    summary: 'Riding the waves',
    vector: vector([0, 0.2, 1]),
    tags: new Set(['sport']),          // Collection types use native JS collections
  }, {
    id: 37,
    summary: 'Meeting Beethoven at the dentist',
    vector: vector([0.2, 0.6, 0]),
  }];
  await table.insertMany(rows);

  // Hm, changed my mind
  await table.updateOne({ id: 103 }, { $set: { summary: 'Surfers\' paradise' } });

  // Let's see what we've got
  const cursor = table.find({})
    .sort({ vector: vector([0, 0.2, 0.4]) }) // Performing a vector search
    .includeSimilarity(true)                 // The found doc is inferred to have `$similarity` as a property now
    .limit(2);

  // This would print:
  // - Surfers' paradise: 0.98238194
  // - Friendly aliens in town: 0.91873914
  for await (const result of cursor) {
    console.log(`${result.summary}: ${result.$similarity}`);
  }

  // Cleanup (if desired)
  await table.drop();
})();
```

### Next steps

- More info and usage patterns are given in the ts-doc of classes and methods
- [TS client reference](https://docs.datastax.com/en/astra/astra-db-vector/clients/typescript.html)
- [Data API reference](https://docs.datastax.com/en/astra/astra-db-vector/api-reference/data-api-commands.html)
- Package on [npm](https://www.npmjs.com/package/@datastax/astra-db-ts)

## High-level architecture

`astra-db-ts`'s abstractions for working at the data and admin layers are structured as depicted by this diagram:

![Class hierarchy diagram](etc/imgs/class-hierarchy.png)

Here's a small admin-oriented example:

```typescript
import { DataAPIClient } from '@datastax/astra-db-ts';

// Spawn an admin 
const client = new DataAPIClient('*TOKEN*');
const admin = client.admin();

(async () => {
  // list info about all databases
  const databases = await admin.listDatabases();
  const dbInfo = databases[0];
  console.log(dbInfo.info.name, dbInfo.id, dbInfo.info.region);

  // list namespaces for the first database
  const dbAdmin = admin.dbAdmin(dbInfo.id, dbInfo.info.region);
  console.log(await dbAdmin.listNamespaces());
})();
```

## Getting the most out of the typing

`astra-db-ts` is a typescript-first library, performing minimal runtime type-checking. As such, it provides
a rich set of types to help you write type-safe code.

Here are some examples of how you can properly leverage types to make your code more robust:

```typescript
// First of all:
// I *highly* recommend writing your query objects & filter objects and such inline with the methods
// to get the best possible type-checking and autocomplete

import { DataAPIClient, StrictFilter, StrictSort, UUID } from '@datastax/astra-db-ts';

const client = new DataAPIClient('*TOKEN*');
const db = client.db('*ENDPOINT*', { namespace: '*NAMESPACE*' });

// You can strictly type your collections for proper type-checking
interface Person {
  _id: UUID,
  name: string,
  interests: {
    favoriteBand?: string,
    friend?: UUID,
  }
}

(async () => {
  // Create your collections with a defaultId type to enforce the type of the _id field
  // (Otherwise it'll default to a string UUID that wouldn't be deserialized as a UUID by the client)
  const collection = await db.createCollection<Person>('my_collection', { defaultId: { type: 'uuidv7' } });

  // Now it'll raise type-errors if you try to insert a document with the wrong shape
  await collection.insertOne({
    _id: new UUID('e7f1f3a0-7e3d-11eb-9439-0242ac130002'),
    name: 'John',
    interests: {
      favoriteBand: 'Nightwish',
    },
    // @ts-expect-error - 'eyeColor' does not exist in type MaybeId<Person>
    eyeColor: 'blue',
  });
})();
```

## Working with Dates

Native JS `Date` objects can be used anywhere in documents to represent dates and times.

Document fields stored using the `{ $date: number }` will also be returned as Date objects when read.

```typescript
import { DataAPIClient } from '@datastax/astra-db-ts';

// Reference an untyped collections
const client = new DataAPIClient('*TOKEN*');
const db = client.db('*ENDPOINT*', { namespace: '*NAMESPACE*' });

(async () => {
  const collection = await db.createCollection('dates_test');
  
  // Insert documents with some dates
  await collection.insertOne({ dateOfBirth: new Date(1394104654000) });
  await collection.insertOne({ dateOfBirth: new Date('1863-05-28') });

  // Update a document with a date and setting lastModified to now
  await collection.updateOne(
    {
      dateOfBirth: new Date('1863-05-28'),
    },
    {
      $set: { message: 'Happy Birthday!' },
      $currentDate: { lastModified: true },
    },
  );

  // Will print *around* `new Date()` (i.e. when server processed the request)
  const found = await collection.findOne({ dateOfBirth: { $lt: new Date('1900-01-01') } });
  console.log(found?.lastModified);
  
  // Cleanup (if desired)
  await collection.drop();
})();
```

## Working with ObjectIds and UUIDs

`astra-db-ts` exports an `ObjectId` and `UUID` class for working with these types in the database.

Note that these are custom classes, and *not* the ones from the `bson` package. Make sure you're using the right one!

```typescript
import { DataAPIClient, ObjectId, UUID } from '@datastax/astra-db-ts';

interface Person {
  _id: ObjectId | UUID,
  name: string,
  friendId?: ObjectId | UUID,
}

// Connect to the db
const client = new DataAPIClient('*TOKEN*');
const db = client.db('*ENDPOINT*', { namespace: '*NAMESPACE*' });

(async () => {
  // Create a collections with a UUIDv7 as the default ID
  const collection = await db.createCollection<Person>('ids_test', { defaultId: { type: 'uuidv7' } });
  
  // You can manually set whatever ID you want
  await collection.insertOne({ _id: new ObjectId("65fd9b52d7fabba03349d013"), name: 'John' });
  
  // Or use the default ID
  await collection.insertOne({ name: 'Jane' });
  
  // Let's give Jane a friend with a UUIDv4 
  const friendId = UUID.v4();

  await collection.insertOne({ name: 'Alice', _id: friendId });
  
  await collection.updateOne(
    { name: 'Jane' },
    { $set: { friendId } },
  );
  
  // And let's get Jane as a document
  // (Prints "Jane", the generated UUIDv4, and true)
  const jane = await collection.findOne({ name: 'Jane' });
  console.log(jane?.name, jane?.friendId?.toString(), friendId.equals(jane?.friendId));
  
  // Cleanup (if desired)
  await collection.drop();
})();
```

## Non-astra support

`astra-db-ts` officially supports Data API instances using non-Astra backends, such as Data API on DSE or HCD. 

However, while support is native, detection is not; you will have to manually declare the environment at times.

```typescript
import { DataAPIClient, UsernamePasswordTokenProvider, DataAPIDbAdmin } from '@datastax/astra-db-ts';

// You'll need to pass in environment to the DataAPIClient when not using Astra
const tp = new UsernamePasswordTokenProvider('*USERNAME*', '*PASSWORD*');
const client = new DataAPIClient(tp, { environment: 'dse' });
const db = client.db('*ENDPOINT*');

// You'll also need to pass it to db.admin() when not using Astra for typing purposes
// If the environment does not match, an error will be thrown as a reminder
const dbAdmin: DataAPIDbAdmin = db.admin({ environment: 'dse' });
dbAdmin.createNamespace(...);
```

The `TokenProvider` class is an extensible concept to allow you to create or even refresh your tokens
as necessary, depending on the Data API backend. Tokens may even be omitted if necessary.

`astra-db-ts` provides two `TokenProvider` instances by default:
- `StaticTokenProvider` - This unit provider simply regurgitates whatever token was passed into its constructor
- `UsernamePasswordTokenProvider` - Turns a user/pass pair into an appropriate token for DSE/HCD

(See `examples/non-astra-backends` for a full example of this in action.)

## Non-standard environment support

`astra-db-ts` is designed foremost to work in Node.js environments. 

It will work in edge runtimes and other non-node environments as well, though it'll use the native `fetch` API for HTTP
requests, as opposed to `fetch-h2` which provides extended HTTP/2 and HTTP/1.1 support for performance.

By default, it'll attempt to use `fetch-h2` if available, and fall back to `fetch` if not available in that environment.
You can explicitly force the fetch implementation when instantiating the client:

```typescript
import { DataAPIClient } from '@datastax/astra-db-ts';

const client = new DataAPIClient('*TOKEN*', {
  httpOptions: { client: 'fetch' },
});
```

There are four different behaviours for setting the client:
- Not setting the `httpOptions` at all
  - This will attempt to use `fetch-h2` if available, and fall back to `fetch` if not available
- `client: 'default'` or `client: undefined` (or unset)
  - This will attempt to use `fetch-h2` if available, and throw an error if not available
- `client: 'fetch'`
  - This will always use the native `fetch` API
- `client: 'custom'`
  - This will allow you to pass a custom `Fetcher` implementation to the client

On some environments, such as Cloudflare Workers, you may additionally need to use the events
polyfill for the client to work properly (i.e. `npm i events`). Cloudflare's node-compat won't
work here.

Check out the `examples/` subdirectory for some non-standard runtime examples with more info.

### HTTP/2 with minification

Due to the variety of different runtimes JS can run in, `astra-db-ts` does its best to be as flexible as possible.
Unfortunately however, because we need to dynamically require the `fetch-h2` module to test whether it works, the
dynamic import often breaks in minified environments, even if the runtime properly supports HTTP/2.

There is a simple workaround however, consisting of the following steps, if you really want to use HTTP/2:
1. Install `fetch-h2` as a dependency (`npm i fetch-h2`)
2. Import the `fetch-h2` module in your code as `fetchH2` (i.e. `import * as fetchH2 from 'fetch-h2'`)
3. Set the `httpOptions.fetchH2` option to the imported module when instantiating the client

```typescript
import { DataAPIClient } from '@datastax/astra-db-ts';
import * as fetchH2 from 'fetch-h2';

const client = new DataAPIClient('*TOKEN*', {
  httpOptions: { fetchH2 },
});
```

This way, the dynamic import is avoided, and the client will work in minified environments.

Note this is not required if you don't explicitly need HTTP/2 support, as the client will default 
to the native fetch implementation instead if importing fails. 

(But keep in mind this defaulting will only happen if `httpOptions` is not set at all).

(See `examples/http2-when-minified` for a full example of this workaround in action.)

### Browser support

The Data API itself does not natively support browsers, so `astra-db-ts` isn't technically supported in browsers either.

However, if, for some reason, you really want to use this in a browser, you can probably do so by installing the 
`events` polyfill and setting up a [CORS proxy](https://github.com/Rob--W/cors-anywhere) to forward requests to the Data API.

But keep in mind that this is not officially supported, and may be very insecure if you're encoding sensitive
data into the browser client.

(See `examples/browser` for a full example of this workaround in action.)
