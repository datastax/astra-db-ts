import { DataAPIClient } from '@datastax/astra-db-ts';

export interface Env {
  ASTRA_DB_TOKEN: string,
  ASTRA_DB_ENDPOINT: string,
}

export default {
  async fetch(_req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    // Creates the client. `astra-db-ts` can automatically infer that it should be using
    // the native `fetch` client under the hood for you.
    const client = new DataAPIClient(env.ASTRA_DB_TOKEN);
    const db = client.db(env.ASTRA_DB_ENDPOINT);

    // Simple example which (attempts to) list all the collections in the database
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
  },
};
