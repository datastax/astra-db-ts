import { DataAPIClient } from '@datastax/astra-db-ts';

const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN!);
const db = client.db(process.env.ASTRA_DB_ENDPOINT!);

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

// export const runtime = 'edge';
