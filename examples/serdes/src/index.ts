import { DataAPIClient, Db } from '@datastax/astra-db-ts';
import 'dotenv/config';

const client = new DataAPIClient(process.env.CLIENT_DB_TOKEN);
const db = client.db(process.env.CLIENT_DB_URL!);

const NAME = 'official_astra_db_ts_serdes_example';

const cleanup = () => Promise.all([db.dropCollection(NAME), db.dropTable(NAME, { ifExists: true })]).then(_ => void _);

(async () => {
  await cleanup();

  const functions: ((name: string, db: Db) => Promise<void>)[] = [
  ];

  for (const func of functions) {
    try {
      console.log(`Running ${func.name}...`);
      console.group();
      await func(NAME, db);
      console.groupEnd();
    } finally {
      await cleanup();
    }
  }
})();
