# astra-db-ts on DSE, HCD, etc.

## Overview

The Data API itself may run on more than just Astra Serverless, and, by extension, so may `astra-db-ts`.

This is a simple example of how we can interact with the Data API on a non-Astra backend. It will create a keyspace
and then list out the keyspaces that exist on the DSE instance.

## Getting Started

### Prerequisites:

- Ensure you have `docker-compose` working on your device.

### How to Use This Example:

1. Clone this repository to your local machine.

2. Run `npm install` to install the required dependencies.

3. Run `docker-compose -f etc/docker-compose-stargate.yml up` to start the services (wait for the Data API to fully start up)

4. Run `npm run start` to run the local `astra-db-ts` script

### Steps to Start Your Own Project:

1. Create a new project as you please.

2. Install `@datastax/astra-db-ts` by running `npm i @datastax/astra-db-ts`.

3. Use the `UsernamePasswordTokenProvider` to create the token provider with your credentials pair.

4. Pass `environment: 'dse'` (or `'hcd'` or whatever) to the `DataAPIClient` (and `db.admin()` if you're using that).

5. You should be able to use `@datastax/astra-db-ts` in your project as normal now.

## Full Code Sample

```ts
import { DataAPIClient, UsernamePasswordTokenProvider } from '@datastax/astra-db-ts';

const client = new DataAPIClient({ environment: 'dse' });

const tp = new UsernamePasswordTokenProvider('userName', 'password');
const db = client.db('http://localhost:8181', { token: tp });

const dbAdmin = db.admin({ environment: 'dse' });

(async () => {
  await dbAdmin.createNamespace('my_keyspace', {
    updateDbNamespace: true,
  });
  
  console.log(await dbAdmin.listNamespaces());
  
  const collection = await db.createCollection('my_coll', {
    checkExists: false,
  });
})();
```
