# @datastax/astra-db-ts

`astra-db-ts` is a TypeScript client for interacting with [DataStax Astra DB](https://astra.datastax.com/signup).

*This README targets v1.0.0+, which introduces a whole new API. Click [here](https://github.com/datastax/astra-db-ts/tree/90ebeac6fec53fd951126c2bcc010c87f7f678f8?tab=readme-ov-file#datastaxastra-db-ts) for the pre-existing client readme.*

## Table of contents
- [Quickstart](#quickstart)
- [High-level architecture](#high-level-architecture)
- [Getting the most out of the typing](#getting-the-most-out-of-the-typing)
- [Working with Dates](#working-with-dates)
- [Working with ObjectIds and UUIDs](#working-with-objectids-and-uuids)
- [Monitoring/logging](#monitoringlogging)
- [Non-standard runtime support](#non-standard-runtime-support)

## Quickstart

Use your preferred package manager to install `@datastax/astra-db-ts`. Note that this is not supported in browsers.

Get the *API endpoint* and your *application token* for your Astra DB instance @ [astra.datastax.com](https://astra.datastax.com).

Try the following code after setting the following environment variables:

```typescript
import { DataAPIClient, VectorDoc, UUID, ObjectId } from '@datastax/astra-db-ts';

// Schema for the collection (VectorDoc adds the $vector field)
interface Idea extends VectorDoc {
  idea: string,
}

// Connect to the db
const client = new DataAPIClient('*TOKEN*');
const db = client.db('*ENDPOINT*', { namespace: '*NAMESPACE*' });

(async () => {
  try {
    // Creates collection, or gets it if it already exists with same options
    const collection = await db.createCollection<Idea>('vector_5_collection', {
      vector: {
        dimension: 5,
        metric: 'cosine'
      },
      checkExists: false,
    });

    // Insert many ideas into the collection
    const ideas = [
      {
        idea: 'An AI quilt to help you sleep forever',
        $vector: [0.1, 0.15, 0.3, 0.12, 0.05],
      },
      {
        _id: new UUID('e7f1f3a0-7e3d-11eb-9439-0242ac130002'),
        idea: 'Vision Vector Frame—A deep learning display that controls your mood',
        $vector: [0.1, 0.05, 0.08, 0.3, 0.6],
      },
      {
        idea: 'A smartwatch that tells you what to eat based on your mood',
        $vector: [0.2, 0.3, 0.1, 0.4, 0.15],
      },
    ];
    await collection.insertMany(ideas);

    // Insert a specific idea into the collection
    const sneakersIdea = {
      _id: new ObjectId('507f191e810c19729de860ea'),
      idea: 'ChatGPT-integrated sneakers that talk to you',
      $vector: [0.45, 0.09, 0.01, 0.2, 0.11],
    }
    await collection.insertOne(sneakersIdea);

    // Actually, let's change that idea
    await collection.updateOne(
      { _id: sneakersIdea._id },
      { $set: { idea: 'Gemini-integrated sneakers that talk to you' } },
    );

    // Get similar results as desired
    const cursor = collection.find({}, {
      vector: [0.1, 0.15, 0.3, 0.12, 0.05],
      includeSimilarity: true,
      limit: 2,
    });

    for await (const doc of cursor) {
      // Prints the following:
      // - An AI quilt to help you sleep forever: 1
      // - A smartwatch that tells you what to eat based on your mood: 0.85490346
      console.log(`${doc.idea}: ${doc.$similarity}`);
    }

    // Cleanup (if desired)
    await collection.drop();
  } finally {
    // Cleans up all open http sessions
    await client.close();
  }
})();
```

Next steps:
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

  // You can use the 'Strict*' version of Sort/Projection/Filter/UpdateFilter for proper type-checking and autocomplete
  await collection.findOne({
    // @ts-expect-error - Type number is not assignable to type FilterExpr<UUID | undefined>
    'interests.friend': 3,
  } satisfies StrictFilter<Person>, {
    sort: {
      name: 1,
      // @ts-expect-error - 'interests.favoriteColor' does not exist in type StrictProjection<Person>
      'interests.favoriteColor': 1 as const,
    } satisfies StrictSort<Person>,
  });
})();
```

## Working with Dates

Native JS `Date` objects can be used anywhere in documents to represent dates and times.

Document fields stored using the `{ $date: number }` will also be returned as Date objects when read.

```typescript
import { DataAPIClient } from '@datastax/astra-db-ts';

// Reference an untyped collection
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
  // Create a collection with a UUIDv7 as the default ID
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

## Monitoring/logging

[Like Mongo](https://www.mongodb.com/docs/drivers/node/current/fundamentals/logging/), `astra-db-ts` doesn't provide a
traditional logging system—instead, it uses a "monitoring" system based on event emitters, which allow you to listen to
events and log them as you see fit.

Supported events include `commandStarted`, `commandSucceeded`, `commandFailed`, and `adminCommandStarted`,
`adminCommandPolling`, `adminCommandSucceeded`, `adminCommandFailed`.

Note that it's disabled by default, and it can be enabled by passing `monitorCommands: true` option to the root options'
`dbOptions` and `adminOptions`.

```typescript
import { DataAPIClient } from '@datastax/astra-db-ts';

const client = new DataAPIClient('*TOKEN*', {
  dbOptions: {
    monitorCommands: true,
  },
});
const db = client.db('*ENDPOINT*');

client.on('commandStarted', (event) => {
  console.log(`Running command ${event.commandName}`);
});

client.on('commandSucceeded', (event) => {
  console.log(`Command ${event.commandName} succeeded in ${event.duration}ms`);
});

client.on('commandFailed', (event) => {
  console.error(`Command ${event.commandName} failed w/ error ${event.error}`);
});

(async () => {
  // Should log
  // - "Running command createCollection"
  // - "Command createCollection succeeded in <time>ms"
  const collection = await db.createCollection('my_collection', { checkExists: false });

  // Should log
  // - "Running command insertOne"
  // - "Command insertOne succeeded in <time>ms"
  await collection.insertOne({ name: 'Queen' });

  // Remove all monitoring listeners
  client.removeAllListeners();

  // Cleanup (if desired) (with no logging)
  await collection.drop();
})();
```

## Non-standard runtime support

`astra-db-ts` is designed foremost to work in Node.js environments, and it's not supported in browsers. It will work
in edge runtimes and other non-node environments as well, though it'll use the native `fetch` API for HTTP requests,
as opposed to `fetch-h2` which provides extended HTTP/2 and HTTP/1.1 support for performance.

On Node (exactly node; not Bun or Deno with node compat on) environments, it'll use `fetch-h2` by default; on others,
it'll use `fetch`. You can explicitly set the fetch implementation when instantiating the client:

```typescript
import { DataAPIClient } from '@datastax/astra-db-ts';

const client = new DataAPIClient('*TOKEN*', {
  httpOptions: {
    client: 'fetch', // or 'default' for fetch-h2
  },
});
```

Note that setting the `httpOptions` implicitly sets the fetch implementation to default (fetch-h2),
so you'll need to set it explicitly if you want to use the native fetch implementation.

On some environments, such as Cloudflare Workers, you may additionally need to use the events
polyfill for the client to work properly (i.e. `npm i events`). Cloudflare's node-compat won't
work here.
