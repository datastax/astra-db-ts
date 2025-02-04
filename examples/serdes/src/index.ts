import { DataAPIClient } from '@datastax/astra-db-ts';
import 'dotenv/config';
import { TableKeyTransformerExample } from '@/src/tables/key-transfomer';
import { CollKeyTransformerExample } from '@/src/collections/key-transfomer';

const client = new DataAPIClient(process.env.CLIENT_DB_TOKEN);
const db = client.db(process.env.CLIENT_DB_URL!);

const NAME = 'official_astra_db_ts_serdes_example';

const cleanup = () => Promise.all([db.dropCollection(NAME), db.dropTable(NAME, { ifExists: true })]).then(_ => void _);

(async () => {
  await cleanup();

  const functions = [
    CollKeyTransformerExample,
    TableKeyTransformerExample,
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
