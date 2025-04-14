import { DataAPIClient } from '@datastax/astra-db-ts';

// Creates the client with the `httpOptions` set to use the `fetch-h2` client for better performance
// However, it's necessary to manually install the `fetch-h2` package & pass it to the client
const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN!, {
  httpOptions: {
    client: 'fetch-h2',
    fetchH2: require('fetch-h2'),
  },
});
const db = client.db(process.env.ASTRA_DB_ENDPOINT!);

// Simple example which (attempts to) list all the collections in the database using http2
export async function GET(_: Request) {
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
}
