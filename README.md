# stargate-mongoose ![ci-tests](https://github.com/stargate/stargate-mongoose/actions/workflows/ci-tests.yml/badge.svg)

`stargate-mongoose` is a Mongoose driver for [JSON API](https://github.com/stargate/jsonapi) which runs on top of Apache Cassandra / DataStax Enterprise.

1. [Quickstart](#quickstart)
2. [Architecture](#architecture)
3. [Version compatibility](#version-compatibility)
4. [Connecting to AstraDB](#connecting-to-astradb)
5. [Sample Applications](#sample-applications)
6. [Features](#features)
7. [NodeJS MongoDB Driver Overriding (experimental)](#nodejs-mongodb-driver-overriding-experimental)
8. [API Reference](APIReference.md)
9. [Developer Guide](DEVGUIDE.md)

## Quickstart
Prerequisites:
node (>=14.0.0), npm/yarn, Docker (for testing the sample app locally using docker compose)
- Start `Docker` on your local machine.
- Clone this repository
```shell
git clone https://github.com/stargate/stargate-mongoose.git
cd stargate-mongoose
```
- Execute below script and wait for it to complete, which starts a simple JSON API on local with a DSE 6.8 (DataStax Enterprise) as database backend.

For macOS/Linux
```shell
bin/start_json_api.sh
```
For Windows
```shell
bin\start_json_api.cmd
```
- Create a sample project called 'sample-app'
```shell
mkdir sample-app
cd sample-app
```
- Initialize and add required dependencies
```shell
npm init -y && npm install express mongoose stargate-mongoose --engine-strict
```
OR
```shell
yarn init -y && yarn add express mongoose stargate-mongoose
```


- Create a file called `index.js` under the 'sample-app' directory and copy below code into the file.
```typescript
//imports
const express = require('express');
const mongoose = require('mongoose');
const stargate_mongoose = require('stargate-mongoose');
const Schema = mongoose.Schema;
const driver = stargate_mongoose.driver;

//override the default native driver
mongoose.setDriver(driver);

//Set up mongoose & end points definition
const Product = mongoose.model('Product', new Schema({ name: String, price: Number }));
mongoose.connect('http://localhost:8181/v1/inventory', {
    username: 'cassandra',
    password: 'cassandra',
    authUrl: 'http://localhost:8081/v1/auth'
});
Object.values(mongoose.connection.models).map(Model => Model.init());
const app = express();
app.get('/addproduct', (req, res) => {
    const newProduct = new Product(
        {
            name: 'product' + Math.floor(Math.random() * 99 + 1),
            price: '' + Math.floor(Math.random() * 900 + 100)
        });
    newProduct.save();
    res.send('Added a product!');
});
app.get('/getproducts', (req, res) => {
    Product.find()
        .then(products => res.json(products));
});

//Start server
const HOST = '0.0.0.0';
const PORT = 8097;
app.listen(PORT, HOST, () => {
    console.log(`Running on http://${HOST}:${PORT}`);
    console.log('http://localhost:' + PORT + '/addproduct');
    console.log('http://localhost:' + PORT + '/getproducts');
});
```
- Execute below to run the app & navigate to the urls listed on the console
```shell
node index.js
```

- Stop the JSON API once the test is complete
```shell
docker compose -f bin/docker-compose.yml down -v
```

## Architecture
### High level architecture
<img src="stargate-mongoose-arch.png" alt="stargate-mongoose usage end to end architecture"/>

### Components
- Cassandra Cluster - Apache Cassandra / DataStax Enterprise Cluster as backend database.
- Stargate Coordinator Nodes - [Stargate](https://stargate.io/) is an open source Data API Gateway for Cassandra. Coordinator is one of the primary components of Stargate which connects the API layer to the backend database. More details can be found [here](https://stargate.io/docs/latest/concepts/concepts.html#stargate-v2-0).
- Stargate JSON API - [JSON API](https://github.com/stargate/jsonapi) is an open source JSON API that runs on top of Stargate's coordinator.
- JavaScript Clients that use Mongoose - Mongoose is an elegant mongodb object modeling library for node.js applications. By implementing a driver required by the Mongoose interface to connect to the JSON API instead of native mongodb access layer, now a JavaScript client can store/retrieve documents on an Apache Cassandra/DSE backend.

The current implementation of the JSON API uses DataStax Enterprise (DSE) as the backend database.

## Version compatibility
| Component/Library Name | Version |
|------------------------|---------|
| Mongoose               | 7.x     |
| DataStax Enterprise    | 6.8.x   |

CI tests are run using the Stargate and JSON API versions specified in the [api-compatibility.versions](api-compatibility.versions) file.

## Connecting to AstraDB
Integration with [AstraDB](https://astra.datastax.com/) is experimental and is not usable/ fully ready at this time.

## Sample Applications

Sample applications developed using `stargate-mongoose` driver are available in below repository.

https://github.com/stargate/stargate-mongoose-sample-apps

## Features

### Connection APIs
| <nobr>Operation Name</nobr> | Description                                                                                                                                           |
|-----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| createDatabase              | When flag `createNamespaceOnConnect` is set to `true` the keyspace passed on to the `mongoose.connect` function via the URL, is created automatically |
| dropDatabase                | Drops the database                                                                                                                                    |
| createCollection            | `mongoose.model('ModelName',modelSchema)` creates a collection as required                                                                            |
| dropCollection              | `model.dropCollection()` drops the collection                                                                                                         |


### Collection APIs
| <nobr>Operation Name</nobr> | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
|-----------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| countDocuments              | `Model.countDocuments(filter)` returns the count of documents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| deleteMany                  | `Model.deleteMany(filter)`. This API will throw an error when more than 20 records are found to be deleted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| deleteOne                   | `Model.deleteOne(filter, options)` options - `sort`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| find                        | `Model.find(filter, projection, options)`  options - `limit`, `pageState`, `skip`, `sort` (skip works only with sorting)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| findOne                     | `Model.findOne(filter, options)` options - `sort` Example: `findOne({}, { sort: { username: -1 } })`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| findOneAndDelete            | `Model.findOneAndDelete(filter, options)` options - `sort`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| findOneAndReplace           | `Model.findOneAndReplace(filter, replacement, options)`<br>__options__<br>` upsert:` (default `false`)<br>`true` - if a document is not found for the given filter, a new document will be inserted with the values in the filter (eq condition) and the values in the `$set` and `$setOnInsert`operators.<br>`false` - new document will not be inserted when no match is found for the given filter<br/>--------<br/>`returnDocument`: (default `before`)<br/>`before` - Return the document before the changes were applied<br/>`after` - Return the document after the changes are applied |
| findOneAndUpdate            | `Model.findOneAndUpdate(filter, update, options)`<br>__options__<br>` upsert:` (default `false`)<br>`true` - if a document is not found for the given filter, a new document will be inserted with the values in the filter (eq condition) and the values in the `$set` and `$setOnInsert`operators.<br>`false` - new document will not be inserted when no match is found for the given filter<br/>--------<br/>`returnDocument`: (default `before`)<br/>`before` - Return the document before the changes were applied<br/>`after` - Return the document after the changes are applied       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| insertMany                  | `Model.insertMany([{docs}], options)` In a single call, only 20 records can be inserted. options - `ordered`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| insertOne                   | `Model.insertOne({doc})`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| updateMany                  | `Model.updateMany(filter, update, options)`<br/>__options__<br>` upsert:` (default `false`)<br>`true` - if a document is not found for the given filter, a new document will be inserted with the values in the filter (eq condition) and the values in the `$set` and `$setOnInsert`operators.<br>`false` - new document will not be inserted when no match is found for the given filter<br><br/>** _This API will throw an error when more than 20 records are found to be updated._                                                                                                        |
| updateOne                   | `Model.updateOne(filter, update, options)`<br>__options__<br>` upsert:` (default `false`)<br>`true` - if a document is not found for the given filter, a new document will be inserted with the values in the filter (eq condition) and the values in the `$set` and `$setOnInsert`operators.<br>`false` - new document will not be inserted when no match is found for the given filter<br/>--------<br/>`returnDocument`: (default `before`)<br/>`before` - Return the document before the changes were applied<br/>`after` - Return the document after the changes are applied              |

### Filter Clause
| Operator           | Description                                                                                                                                                    |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| literal comparison | Equal to. Example: `{ 'first_name' : 'jim' }`                                                                                                                  |
| $eq                | Example: `{ 'first_name' : { '$eq' : 'jim' } }`                                                                                                                |
| $gt                | Not supported. Example (age > 25): `{ 'age' : { '$gt' : 25 } }`                                                                                                |
| $gte               | Not supported. Example (age >= 25): `{ 'age' : { '$gte' : 25 } }`                                                                                              |
| $lt                | Not supported. Example (age < 25): `{ 'age' : { '$lt' : 25 } }`                                                                                                |
| $lte               | Not supported. Example (age <= 25): `{ 'age' : { '$lte' : 25 } }`                                                                                              |
| $ne                | Not supported. Not Equal to. Example: `{ 'first_name' : { '$ne' : 'jim' } }`                                                                                   |
| $in                | Example: `{ '_id' : { '$in' : ['nyc', 'la'] } }` $in is not supported in non _id columns at the moment                                                         |
| $nin               | Not supported. Example: `{ 'address.city' : { '$nin' : ['nyc', 'la'] } }`                                                                                      |
| $not               | Not supported. Example: `{ 'first_name' : { '$not' : { '$eq' : 'jim' }}}`                                                                                      |
| $exists            | Example: `{ 'address.city' : { '$exists' : true} }`                                                                                                            |
| $all               | Array operation. Matches if all the elements of an array matches the given values. Example: `{ 'tags' : { '$all' : [ 'home', 'school' ] } }`                   |
| $elemMatch         | Not supported. Matches if the elements of an array in a document matches the given conditions. Example: `{'goals': { '$elemMatch': { '$gte': 2, '$lt': 10 }}}` |
| $size              | Array Operation. Example: `{ 'tags' : { '$size' : 1 } }`                                                                                                       |
| $and (implicit)    | Logical expression. Example : ` { '$and' : [ {first_name : 'jim'}, {'age' : {'$gt' : 25 } } ] } `                                                              |
| $and (explicit)    | Not supported. Example : ` { '$and' : [ {first_name : 'jim'}, {'age' : {'$gt' : 25 } } ] } `                                                                   |
| $or                | Not supported                                                                                                                                                  |

### Projection Clause
| Operator                | Description                                                                                                                      |
|-------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| $elemMatch (projection) | Not supported                                                                                                                    |
| $slice                  | Array related operation. Example: `{ 'tags' : { '$slice': 1 }}` returns only the first element from the array field called tags. |
| $ (projection)          | Example: Model.find({}, { username : 1, _id : 0}) - This returns username in the response and the _id field                      |

### Sort Clause
| Operator          | Description   |
|-------------------|---------------|
| Single Field Sort | Supported     |
| Multi Field Sort  | Not supported |

### Update Clause
| Operator     | Description                                                                                                                                                                       |
|--------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| $inc         | Example: `{ '$inc': { 'points' : 5 } }`                                                                                                                                           |
| $min         | Example: `{ 'col': { '$min' : 5 } }` if the columns value is greater than 5, it will be updated with 5                                                                            |
| $max         | Example: `{ 'col': { '$max' : 50 } }` if the columns value is lesser than 50, it will be updated with 50                                                                          |
| $rename      | Example: `{ $rename: { '$max' : 50 } }` if the columns value is lesser than 50, it will be updated with 50                                                                        |
| $set         | Example: `{'update' : {'$set': {'location': 'New York'} }}`                                                                                                                       |
| $setOnInsert | Example: `{'update' : {'$set': {'location': 'New York'}, '$setOnInsert': {'country': 'USA'} }}`                                                                                   |
| $unset       | Example: `{'update' : {'$unset': [address.location] }}`                                                                                                                           |
| $addToSet    | Example: `{'$addToSet' : {'points': 10}}`. This will add 10 to an array called `points` in the documents, without duplicates (i.e. ll skip if 10 is already present in the array) |
| $pop         | Example: `{'$pop' : {'points': 1 }}`. This removes the last 1 item from an array called `points`. -1 will remove the first 1 item.                                                |
| $pull        | Not supported                                                                                                                                                                     |
| $push        | Example. `'$push': {'tags': 'work'}`. This pushes an element called `work` to the array `tags`                                                                                    |
| $pullAll     | Not supported                                                                                                                                                                     |


### Index Operations

Index operations are not supported. There is one caveat for `ttl` indexes: When adding a document, you can add a `ttl` option (determined in seconds) that will behave in the similar way to a `ttl` index. For example, with the collection's client:

```javascript
import { Client } from 'stargate-mongoose';
// connect to JSON API
const client = await Client.connect(process.env.JSON_API_URI);
// get a collection
const collection = client.db().collection('docs');
// insert and expire this document in 10 seconds
await collection.insertOne({ hello: 'world' }, { ttl: 10 });
```

### Aggregation Operations

Aggregation operations are not supported.

### Transaction Operations

Transaction operations are not supported.

## NodeJS MongoDB Driver Overriding (experimental)

If you have an application that uses the NodeJS MongoDB driver, or a dependency that uses the NodeJS MongoDB driver, it is possible to override its use with the collections package of `stargate-mongoose`. This makes your application use JSON API documents instead of MongoDB documents. Doing so requires code changes in your application that address the features section of this README, and a change in how you set up your client connection.

If your application uses `mongodb` you can override its usage like so:

In your app's `mongodb` `package.json` entry:

```
"mongodb": "stargate-mongoose@0.2.0-ALPHA-3",
```

Then, re-install your dependencies

```bash
npm i
```

Finally, modify your connection so that your driver connects to JSON API

```javascript
import { MongoClient } from 'stargate-mongoose';

// connect to JSON API
const client = await MongoClient.connect(process.env.JSON_API_URI);
```

If you have an application dependency that uses `mongodb`, you can override its usage like so (this example uses `mongoose`):

Add an override to your app's `package.json` (requires NPM 8.3+), also, add `stargate-mongoose as a dependency:

```
"dependencies": {
    "stargate-mongoose": "^0.2.0-ALPHA-3"
},
"overrides": {
    "mongoose": {
        "mongodb":  "stargate-mongoose@0.2.0-ALPHA-3"
    }
},
```

Then, re-install your dependencies

```bash
npm i
```

Finally, modify your dependencies connection so that your driver connects to JSON API

```javascript
import mongoose from 'mongoose';

// connect to JSON API
await mongoose.connect(process.env.JSON_API_URI);
```
