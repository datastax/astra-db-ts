import { DataAPIClient } from '@datastax/astra-db-ts';

// Creates the client. Because the code is minified (when ran), astra-db-ts will default to using
// `fetch` as the HTTP client. If you need HTTP/2, please see `examples/http2-when-minified` for more
// information on how to use HTTP/2 with Next.js
const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN!);
const db = client.db(process.env.ASTRA_DB_ENDPOINT!);

// You may use the edge runtime as normal as well. HTTP/2 is not supported here, at all.
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
