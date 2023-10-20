# @datastax/astra-ts-client

Astra TS is a TypeScript library for interacting with the [Astra](https://astra.datastax.com/) API.

## Initializing the client

```typescript
import { Astra } from "@datastax/astra-ts-client";

const astra = new Astra({
  token: 'REPLACE_ME',
  databaseId: 'REPLACE_ME',
  databaseRegion: 'REPLACE_ME'
});
```

## Create a collection
```typescript
const astra = new Astra({
  token: 'REPLACE_ME',
  databaseId: 'REPLACE_ME',
  databaseRegion: 'REPLACE_ME'
});

await astra.createCollection('test')

```












# npx openapicmd typegen https://f4289d82-c98b-443a-a0d0-a8cddb267f72-us-east1.apps.astra.datastax.com/api/json/openapi.yaml > astra.d.ts