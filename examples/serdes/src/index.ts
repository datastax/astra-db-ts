import { DataAPIClient } from '@datastax/astra-db-ts';
import 'dotenv/config';
import { TableCustomDatatypesExample } from '@/src/tables/custom-datatypes';
import { CollectionClassMappingExample } from '@/src/collections/class-mapping';

const client = new DataAPIClient(process.env.CLIENT_DB_TOKEN);
const db = client.db(process.env.CLIENT_DB_URL!);

const NAME = 'official_serdes_example';

const cleanup = () => db.dropCollection(NAME);

(async () => {
  await cleanup();

  const functions = [
    TableCustomDatatypesExample,
    CollectionClassMappingExample,
  ];

  for (const func of functions) {
    await using _ = { [Symbol.asyncDispose]: cleanup };
    console.log(`Running ${func.name}...`);
    await func(NAME, db);
  }
})();
