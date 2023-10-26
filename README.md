# @datastax/astra-db-ts

## Getting Started

```typescript
import { AstraDB } from "@datastax/astra-db-ts";

const { TOKEN, DATABASE_ID, REGION, COLLECTION_NAME } = process.env;

const astraDb = new AstraDB(TOKEN, DATABASE_ID, REGION);
const collection = await astraDb.collection(COLLECTION_NAME);
const results = await collection.countDocuments();
```
