# @datastax/astra-ts-client

## Getting Started

```typescript
import { AstraDB } from "@datastax/astra-ts-client";
const astraDb = new AstraDB(TOKEN, DATABASE_ID, REGION);
const collection = await astraDb.collection("events");
const results = await collection.countDocuments();
```