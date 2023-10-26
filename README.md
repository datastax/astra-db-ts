# @datastax/astra-db-ts

## Getting Started

```typescript
import { AstraDB } from "@datastax/astra-db-ts";
const astraDb = new AstraDB(TOKEN, DATABASE_ID, REGION);
const collection = await astraDb.collection("events");
const results = await collection.countDocuments();
```