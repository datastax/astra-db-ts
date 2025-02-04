import { DataAPIClient } from '@datastax/astra-db-ts';
import * as fetchH2 from 'fetch-h2';

// Creates the client with the `httpOptions` set to use the `fetch` client as next.js's minification
// conflicts with the importing of our default http client (see http2-when-minified for more info)
const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN!, {
  httpOptions: {
    client: 'fetch-h2',
    fetchH2: fetchH2,
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
