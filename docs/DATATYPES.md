# Datatypes

`astra-db-ts` exports a variety of custom datatype classes to represent their respective types in the database.

Some types are strictly meant for tables; others for collections. And a couple, i.e. `UUID` and `DataAPIVector`, are used in both.

## Collections

### Overview

Types in collections are natively represented through the `{ $type: '<value>' }` syntax, e.g.

```typescript
await collection.insertOne({
  date: { $date: 1734070574056 },
  uuid: { $uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
  oid: { $objectId: '507f1f77bcf86cd799439011' },
});
```

However, `astra-db-ts` provides utility types to make working with these values easier.

The idiomatic equivalent to the above would be:

```typescript
import { UUID, ObjectId } from '@datastax/astra-db-ts';

await collection.insertOne({
  date: new Date(),
  uuid: UUID.v4(),
  oid: new ObjectId(),
});
```

Or, if you prefer to use the available shorthand functions:

```typescript
import { uuid, oid } from '@datastax/astra-db-ts';

await collection.insertOne({
  date: new Date(),
  uuid: uuid(4),
  oid: oid(),
});
```

### Vectors

`$vector`/`$vectorize` are a special case where they're not types, but rather a special reserved name for working with an embedding vector.

```typescript
import { vector } from '@datastax/astra-db-ts';

await collection.insertOne({
  $vector: vector([1, 2, 3]), // Equivalent to `new DataAPIVector([1, 2, 3])`
});
```

Using `DataAPIVector` for insertion isn't strictly necessary; neither `astra-db-ts`, nor the server, will complain if the vector is inserted in any of the following ways:
- `$vector: [1, 2, 3]`
- `$vector: { $binary: '<b64_str>' }`
- `$vector: new DataAPIVector([1, 2, 3])`
- `$vector: vector([1, 2, 3])`

However, keep in mind that when `find`-ing, the `$vector` will _always_ be returned as a `DataAPIVector`, to smooth the difference between the underlying representations.

## Tables

## Cheatsheet

### Collections

| Type        | Type            | Shorthand | Examples                                                       |
|-------------|-----------------|-----------|----------------------------------------------------------------|
| `$date`     | `Date`          | N/A       | `new Date()`                                                   |
| `$uuid`     | `UUID`          | `uuid`    | `new UUID('...')`, `UUID.v4()`, `uuid('...')`, `uuid(7)`       |
| `$objectId` | `ObjectId`      | `oid`     | `new ObjectId()`, `new ObjectId('...')`, `oid()`, `oid('...')` |
| `$vector`   | `DataAPIVector` | `vector`  | `new DataAPIVector([1, 2, 3])`, `vector([1, 2, 3])`            |

### Tables

| Type       | Type              | Shorthand  | Examples                                                                             |
|------------|-------------------|------------|--------------------------------------------------------------------------------------|
| `ascii`    | `string`          | N/A        | `'Hello!'`                                                                           |
| `bigint`   | `number`          | N/A        | `42`                                                                                 |
| `blob`     | `DataAPIBlob`     | `blob`     | `new DataAPIBlob(Buffer.from(...))`, `blob({ $binary: '<b64_str>' })`                |
| `boolean`  | `boolean`         | N/A        | `true`                                                                               |
| `date`     | `DataAPIDate`     | `date`     | `new DataAPIDate()`, `date(new Date(1734070574056))`, `date('1992-05-28')`, `date()` |
| `decimal`  | `BigNumber`       | N/A        | `new BigNumber(123.4567)`, `BigNumber('123456.7e-3')`                                |
| `double`   | `number`          | N/A        | `3.14`, `NaN`, `Infinity`, `-Infinity`                                               |
| `duration` | `DataAPIDuration` | `duration` | `new DataAPIDuration('3w')`, `duration('P5DT30M')`                                   |
| `float`    | `number`          | N/A        | `3.14`, `NaN`, `Infinity`, `-Infinity`                                               |
| `inet`.    | `InetAddress`     | `inet`     | `new InetAddress('::1')`, `inet('127.0.0.1')`                                        |
| `int`      | `number`          | N/A        | `42`                                                                                 |
| `smallint` | `number`          | N/A        | `42`                                                                                 |
| `text`     | `string`          | N/A        | `'Hello!'`                                                                           |
| `time`     | `DataAPITime`     | `time`     | `new DataAPITime()`, `time(new Date(1734070574056))`, `time('12:34:56')`, `time()`   |
| `timestamp`| `DataAPITimestamp`| `timestamp`| `new DataAPITimestamp('...')`, `timestamp(new Date(1734070574056))`, `timestamp()`   |
| `timeuuid` | `UUID`            | `timeuuid` | `new UUID('...')`, `UUID.v1()`, `timeuuid('...')`, `timeuuid(7)`                     |
