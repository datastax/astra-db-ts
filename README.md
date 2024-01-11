# @datastax/astra-db-ts

`astra-db-ts` is a TypeScript client for interacting with [DataStax Astra DB](https://astra.datastax.com/signup).

## Getting Started

```typescript
import { AstraDB } from "@datastax/astra-db-ts";

async function main() {

  const ASTRA_DB_API_ENDPOINT = process.env['ASTRA_DB_API_ENDPOINT'];
  const ASTRA_DB_APPLICATION_TOKEN = process.env['ASTRA_DB_APPLICATION_TOKEN'];

  const db = new AstraDB(ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_API_ENDPOINT);

  // Create a vector collection
  await db.createCollection("vector_5_collection", { vector: { dimension: 5, metric: "cosine" } });
  const collection = await db.collection("vector_5_collection");

  const documents = [
    {
      "_id": "1",
      "text": "ChatGPT integrated sneakers that talk to you",
      "$vector": [0.1, 0.15, 0.3, 0.12, 0.05],
    },
    {
      "_id": "2",
      "text": "An AI quilt to help you sleep forever",
      "$vector": [0.45, 0.09, 0.01, 0.2, 0.11],
    },
    {
      "_id": "3",
      "text": "Vision Vector Frame - A deep learning display that controls your mood",
      "$vector": [0.1, 0.05, 0.08, 0.3, 0.6],
    }
  ];
  await collection.insertMany(documents);

  // Return the number of documents in the collection
  const results = await collection.countDocuments();
  console.log(results);
}

main().catch(console.error);
```

## Usage

Refer to the API [reference documentation](https://docs.datastax.com/en/astra/astra-db-vector/clients/typescript.html) for more information and usage examples. 
