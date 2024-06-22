import { DataAPIClient, UsernamePasswordTokenProvider } from '@datastax/astra-db-ts';

// Creates the client. Need to pass in the environment parameter so `astra-db-ts` can adjust properly.
const client = new DataAPIClient({ environment: 'dse' });

// Use the token provide to set up your credentials easily
const tp = new UsernamePasswordTokenProvider('cassandra', 'cassandra');
const db = client.db('http://localhost:8181', { token: tp });

// db.admin() needs the environment passed in for proper typing purposes
// Note that it's typed as returning 'DataAPIDbAdmin' instead of 'DbAdmin' or 'AstraDbAdmin'
const dbAdmin = db.admin({ environment: 'dse' });

// Creates a new namespace and lists all namespaces that now exist
// Note that the db is not properly configured to use the keyspace that's just been created yet.
(async () => {
  await dbAdmin.createNamespace('my_keyspace');
  console.log(await dbAdmin.listNamespaces());
})();
