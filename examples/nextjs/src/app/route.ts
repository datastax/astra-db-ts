import { DataAPIClient } from '@datastax/astra-db-ts';

// Create a new client and database instance
const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN!);
const db = client.db(process.env.ASTRA_DB_ENDPOINT!);

// You may use the edge runtime as normal as well.
// export const runtime = 'edge';

// Simple example which (attempts to) list all the collections in the database
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
