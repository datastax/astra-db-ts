import { DataAPIClient } from '@datastax/astra-db-ts';
import 'dotenv/config';

const client = new DataAPIClient(process.env.CLIENT_DB_TOKEN);
const db = client.db(process.env.CLIENT_DB_URL!);

const NAME = 'official_serdes_example';

const cleanup = () => db.dropCollection(NAME);

(async () => {
  await cleanup();
  await using _ = { [Symbol.asyncDispose]: cleanup };
  const example = await import('./tables/everything');
  await example.default(NAME, db);
})();
