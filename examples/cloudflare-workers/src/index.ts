import { DataAPIClient } from '@datastax/astra-db-ts';

export interface Env {
  ASTRA_DB_TOKEN: string,
  ASTRA_DB_ENDPOINT: string,
}

export default {
  async fetch(_req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const client = new DataAPIClient(env.ASTRA_DB_TOKEN);
    const db = client.db(env.ASTRA_DB_ENDPOINT);

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
