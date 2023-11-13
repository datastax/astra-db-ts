# @datastax/astra-db-ts

`astra-db-ts` is a TypeScript client for interacting with [DataStax Astra DB](https://astra.datastax.com/signup).

## Getting Started

```typescript
import { AstraDB } from "@datastax/astra-db-ts";

const { TOKEN, DATABASE_ID, REGION, COLLECTION_NAME, ENDPOINT } = process.env;

const astraDb = new AstraDB(TOKEN, DATABASE_ID, REGION);
// or...
// const astraDb = new AstraDB(TOKEN, ENDPOINT);

// Create a collection
const collection = await astraDb.collection(COLLECTION_NAME);

// Return the number of documents in the collection
const results = await collection.countDocuments();
```
