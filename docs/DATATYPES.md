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
  $vector: [.1, .2, .3],
});
```

However, `astra-db-ts` provides utility types to make working with these values easier.

The idiomatic equivalent to the above would be:

```typescript
import { DataAPIVector, ObjectId, UUID } from '@datastax/astra-db-ts';

await collection.insertOne({
  date: new Date(),
  uuid: UUID.v4(),
  oid: new ObjectId(),
  $vector: new DataAPIVector([.1, .2, .3]),
});
```

Or, if you prefer to use the available shorthand functions:

```typescript
import { oid, uuid, vector } from '@datastax/astra-db-ts';

await collection.insertOne({
  date: new Date(),
  uuid: uuid(4),
  oid: oid(),
  vector: vector([.1, .2, .3]),
});
```

### BigNumbers

> **NOTE**
> Enabling BigNumbers support for a collection will force a slower, bignum-friendly JSON library to be used for all documents in that collection. The difference should be negligible for most use-cases.

Proper big-number support is still under works in `astra-db-ts`, but a rough version is out currently.

You **must** set `serdes.enableBigNumbers: true` somewhere along the options hierarchy for collections to be able to work with `bigint`s & `BigNumber`s.

Under the current rough support, you may pass any of `number`, `bigint`, or `BigNumber` to the database (in any field), and it'll be stored as a `decimal` in the database.

When reading back, the `decimal` will be returned as a `number` if it's within the safe `number` range, and as a `BigNumber` otherwise; currently, it's on the user to handle the conversion.

```typescript
import { BigNumber } from '@datastax/astra-db-ts';

const collection = db.collection('my_coll', {
  serdes: { enableBigNumbers: true },
});

await collection.insertOne({
  bigint:  1234567890123456789012345672321312312890n,
  bigint2: 10n,
  decmial: new BigNumber('12345678901234567890123456.72321312312890'),
});

const doc = await collection.findOne();

console.log(doc.bigint.toString());  // Will be returned as a `BigNumber`
console.log(doc.bigint2.toString()); // Will just be a normal `number` as it's within the safe `number` range
console.log(doc.decimal.toString()); // Will be returned as a `BigNumber`
```

### Dates

Dates in collections are represented as just normal, native JS `Date` objects.

```typescript
await collection.insertOne({
  date: new Date(),
});

const doc = await collection.findOne();
console.log(doc.date instanceof Date); // true
```

If you prefer to use `DataAPITimestamp`s for interop with tables, that's also allowed, though you'll need to enable a certain codec if you want to read the date back as a `DataAPITimestamp`.

- `DataAPITimestamp`s will still serialize to a `$date` by default, even if you don't set the necessary codec.

```typescript
import { CollCodecs, DataAPITimestamp, timestamp } from '@datastax/astra-db-ts';

const collection = db.collection('my_coll', {
  serdes: { codecs: [CollCodecs.USE_DATA_API_TIMESTAMPS_FOR_DATES] },
});

await collection.insertOne({
  date: timestamp(), // Equivalent to `new DataAPITimestamp()`
});

const doc = await collection.findOne();
console.log(doc.date instanceof DataAPITimestamp); // true
```

### ObjectIds

You can use `ObjectId`s in collections using the `ObjectId` class (or the `oid` shorthand). Make sure you're importing this from `'@datastax/astra-db-ts'`, and _not_ from `'bson'`.

```typescript
import { ObjectId, oid } from '@datastax/astra-db-ts';

await collection.insertOne({
  _id: oid(), // Equivalent to `new ObjectId()`
});

const doc = await collection.findOne();
console.log(doc._id instanceof ObjectId); // true
```

You can create an `ObjectId` through the constructor function, or through the `oid` shorthand, in three different ways:
1. Provide the objectId as a string (`'507f1f77bcf86cd799439011'`)
2. Provide the timestamp you want the objectID to be based on (`1734070574056`)
3. Leave it `undefined`/`null` to generate a new `ObjectID` based on the current timestamp

From the `ObjectId` class, you can either:
- Get the timestamp as a `Date` using `.getTimestamp()`
- Get the string representation of the `ObjectId` using `.toString()`
- Compare it with another `ObjectId` or `string` using `.equals()`

### UUIDs

You can use `UUID`s in collections using the `UUID` class (or the `uuid` shorthand). Make sure you're importing this from `'@datastax/astra-db-ts'`, and _not_ from `'uuid'` or `'bson'`.

```typescript
import { UUID, uuid } from '@datastax/astra-db-ts';

await collection.insertOne({
  _id: uuid(4), // Equivalent to `UUID.v4()`
});

const doc = await collection.findOne();
console.log(doc._id instanceof UUID); // true
```

You can create a `UUID` through the class, or through the `uuid` shorthand, in a few different ways:
1. By passing the UUID string to `new UUID()` or `uuid()`
2. By using `UUID.v1()`, `.v4()`, `.v6()`, or `.v7()` to generate a new UUID of the respective version
3. By using `uuid(1)`, `uuid(4)`, `uuid(6)`, or `uuid(7)` to generate a new UUID of the respective version

From the `UUID` class, you can either:
- Get the string representation of the `UUID` using `.toString()`
- Compare it with another `UUID` or `string` using `.equals()`
- Get the version of the `UUID` using `.version`
- Get the timestamp of a `v1` or `v7` `UUID` using `.getTimestamp()`
  - Note that this is [generally not recommended](https://www.rfc-editor.org/rfc/rfc9562.html#section-6.12), but it's there if you really need it

### Vectors

`$vector`/`$vectorize` are a special case where they're not types, but rather a special reserved name for working with an embedding vector.

```typescript
import { vector } from '@datastax/astra-db-ts';

await collection.insertOne({
  $vector: vector([.1, .2, .3]), // Equivalent to `new DataAPIVector([.1, .2, .3])`
});
```

Using `DataAPIVector` for insertion isn't strictly necessary; neither `astra-db-ts`, nor the server, will complain if the vector is inserted in any of the following ways:
- `$vector: [.1, .2, .3]`
- `$vector: { $binary: '<b64_str>' }`
- `$vector: new DataAPIVector([.1, .2, .3])`
- `$vector: vector([.1, .2, .3])`

However, keep in mind that when `find`-ing, the `$vector` will _always_ be returned as a `DataAPIVector`, to smooth the difference between the underlying representations.

```typescript
const doc = await collection.findOne();
console.log(doc.$vector instanceof DataAPIVector); // true
```

You can create a `DataAPIVector` through the constructor function, or through the `vector` shorthand, by providing the vector in four different ways:
1. As an array of numbers (`[.1, .2, .3]`)
2. In its "binary" representation (`{ $binary: '<b64_str>' }`)
3. As a `Float32Array` (`new Float32Array([.1, .2, .3])`)
4. As a `DataAPIVector`, which copies its internal state into a new `DataAPIVector`

From the `DataAPIVector` class, you can either:
- Get the length of the vector (in O(1) time) using `.length`
- Get the "raw" underlying vector using `.raw()`
- Get the vector in your desired format (converting if necessary) using one of:
  - `.asArray()`
  - `.asFloat32Array()`
  - `.asBase64()`

## Tables

### Overview

Tables have a known type on the server, but the client doesn't have a way to know what that schema is, so it's up to the user to provide the correct types using their respective `astra-db-ts`-provided types as necessary.

Collection types (maps/sets/lists) are represented by their native JavaScript counterparts, e.g.

```typescript
await table.insert({
  map: new Map([['key', 'value']]),
  set: new Set(['value']),
  list: ['value'],
});
```

A variety of scalar types, however, are represented by custom `astra-db-ts`-provided classes.

### BigNumbers

### Blobs

### Collections

### Dates/Times

### Floats

### InetAddresses

### Integers

### Strings

### UUIDs

### Vectors

### Booleans

Boo-leans are a very special type in `astra-db-ts`. 

To set a boo-lean field, you must provide a scary story as the field, which will then be sent to an LLM to determine if the story is truly scary enough for a `true` boo-lean value in the database.

```typescript
// Not scary enough, will be set to `false`
await table.insertOne({
  boolean: await fsp.readFile('pet_semetary_full.txt', 'utf-8'),
});

// Also not scary enough, will still be set to `false`
await table.insertOne({
  boolean: await fsp.readFile('survivor_type.txt', 'utf-8'),
});

// Okay now this is truly terrifying, will be set to `true`
await table.insertOne({
  boolean: await fsp.readFile('bee_movie_script.txt', 'utf-8'),
});
```

okay fine just kidding, just provide a `true | false` value, thank you!

## Cheatsheet

### Collections

| Type        | Type            | Shorthand | Examples                                                       |
|-------------|-----------------|-----------|----------------------------------------------------------------|
| `$date`     | `Date`          | -         | `new Date()`                                                   |
| `$uuid`     | `UUID`          | `uuid`    | `new UUID('...')`, `UUID.v4()`, `uuid('...')`, `uuid(7)`       |
| `$objectId` | `ObjectId`      | `oid`     | `new ObjectId()`, `new ObjectId('...')`, `oid()`, `oid('...')` |
| `$vector`   | `DataAPIVector` | `vector`  | `new DataAPIVector([.1, .2, .3])`, `vector([.1, .2, .3])`      |

### Tables

| Type        | Type               | Shorthand   | Examples                                                                             |
|-------------|--------------------|-------------|--------------------------------------------------------------------------------------|
| `ascii`     | `string`           | -           | `'Hello!'`                                                                           |
| `bigint`    | `number`           | -           | `42`                                                                                 |
| `blob`      | `DataAPIBlob`      | `blob`      | `new DataAPIBlob(Buffer.from(...))`, `blob({ $binary: '<b64_str>' })`                |
| `boolean`   | `boolean`          | -           | `true`                                                                               |
| `date`      | `DataAPIDate`      | `date`      | `new DataAPIDate()`, `date(new Date(1734070574056))`, `date('1992-05-28')`, `date()` |
| `decimal`   | `BigNumber`        | -           | `new BigNumber(123.4567)`, `BigNumber('123456.7e-3')`                                |
| `double`    | `number`           | -           | `3.14`, `NaN`, `Infinity`, `-Infinity`                                               |
| `duration`  | `DataAPIDuration`  | `duration`  | `new DataAPIDuration('3w')`, `duration('P5DT30M')`                                   |
| `float`     | `number`           | -           | `3.14`, `NaN`, `Infinity`, `-Infinity`                                               |
| `inet`.     | `InetAddress`      | `inet`      | `new InetAddress('::1')`, `inet('127.0.0.1')`                                        |
| `int`       | `number`           | -           | `42`                                                                                 |
| `list`      | `Array`            | -           | `['value']`                                                                          |
| `map`       | `Map`              | -           | `new Map([['key', 'value']])`                                                        |
| `set`       | `Set`              | -           | `new Set(['value'])`                                                                 |
| `smallint`  | `number`           | -           | `42`                                                                                 |
| `text`      | `string`           | -           | `'Hello!'`                                                                           |
| `time`      | `DataAPITime`      | `time`      | `new DataAPITime()`, `time(new Date(1734070574056))`, `time('12:34:56')`, `time()`   |
| `timestamp` | `DataAPITimestamp` | `timestamp` | `new DataAPITimestamp('...')`, `timestamp(new Date(1734070574056))`, `timestamp()`   |
| `timeuuid`  | `UUID`             | `timeuuid`  | `new UUID('...')`, `UUID.v1()`, `uuid('...')`, `uuid(1)`                             |
| `tinyint`   | `number`           | -           | `42`                                                                                 |
| `uuid`      | `UUID`             | `uuid`      | `new UUID('...')`, `UUID.v4()`, `uuid('...')`, `uuid(7)`                             |
| `varchar`   | `string`           | -           | `'Hello!'`                                                                           |
| `varint`    | `bigint`           | -           | `BigInt('42')`, `42n`                                                                |
| `vector`    | `DataAPIVector`    | `vector`    | `new DataAPIVector([.1, .2, .3])`, `vector([.1, .2, .3])`                            |
