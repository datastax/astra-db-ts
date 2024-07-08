import { DataAPIClient, UsernamePasswordTokenProvider, UUID } from '@datastax/astra-db-ts';

// Creates the client. Need to pass in the environment parameter so `astra-db-ts` can adjust properly
const client = new DataAPIClient({ environment: 'dse' });

// Use the token provide to set up your credentials easily
const tp = new UsernamePasswordTokenProvider('cassandra', 'cassandra');

// Creates a Db without a namespace
// The namespace will be set later when doing `createNamespace`
const db = client.db('http://localhost:8181', { token: tp });

// db.admin() needs the environment passed in for proper typing purposes
// Note that it's typed as returning 'DataAPIDbAdmin' instead of 'DbAdmin' or 'AstraDbAdmin'
const dbAdmin = db.admin({ environment: 'dse' });

(async () => {
  // Creates the new namespace 'my_keyspace'
  // The Db that spawned the DbAdmin is updated to use the new namespace
  await dbAdmin.createNamespace('my_keyspace', {
    updateDbNamespace: true,
  });

  // The list of namespaces will now include 'my_keyspace'
  console.log(await dbAdmin.listNamespaces());

  // Creates a collection in the 'my_keyspace' namespace
  const collection = await db.createCollection('my_coll', {
    checkExists: false,
  });

  // Example of document manipulation in the newly created namespace
  const _id = UUID.v7();
  await collection.insertOne({ _id });
  await collection.deleteOne({ _id });
})();
