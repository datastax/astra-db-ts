import * as fs from 'fs';
import * as util from 'util';
import { v4 as uuid } from 'uuid';

import { AstraDB, Collection }                                   from "../../src";
import { SomeDoc, VectorDoc, InsertOneResult, InsertManyResult, Filter } from '../../src/client';

const ASTRA_DB_APPLICATION_TOKEN: string = process.env.ASTRA_DB_APPLICATION_TOKEN || '';
const ASTRA_DB_API_ENDPOINT: string = process.env.ASTRA_DB_API_ENDPOINT|| '';
let db : AstraDB | null = null;
let collection_simple : Collection | null = null;
let collection_vector : Collection | null = null;

const complete_document = {
    "metadata_instant": {
      "$date": 1709206444613
    },
    "metadata_short_array": [
      1,
      2,
      3
    ],
    "metadata_calendar": {
      "$date": 1709206444613
    },
    "metadata_double_array": [
      1.0,
      2.0,
      3.0
    ],
    "metadata_object": {
      "product_name": "name",
      "product_price": 1.0
    },
    "metadata_list": [
      "value1",
      "value2"
    ],
    "metadata_uuid_array": [
      "a7c5b70f-ec82-4002-bad3-32fb7a15dfd8",
      "ce26c4ed-ca33-470f-87f9-7c280eeb7f1f"
    ],
    "metadata_character": "c",
    "metadata_string_array": [
      "a",
      "b",
      "c"
    ],
    "metadata_date": {
      "$date": 1709206444613
    },
    "metadata_float": 1.1232435,
    "metadata_short": 1,
    "metadata_double": 1213.343243,
    "metadata_int": 1,
    "metadata_long": 12321323,
    "metadata_int_array": [
      1,
      2,
      3
    ],
    "metadata_boolean": true,
    "metadata_uuid": "b8596136-a210-44ba-b910-5c322e373c42",
    "metadata_long_array": [
      1,
      2,
      3
    ],
    "metadata_enum": "GCP",
    "metadata_enum_array": [
      "GCP",
      "AWS"
    ],
    "metadata_map": {
      "key2": "value2",
      "key1": "value1"
    },
    "metadata_float_array": [
      1.0,
      2.0,
      3.0
    ],
    "metadata_byte": 1,
    "metadata_string": "hello",
    "metadata_boolean_array": [
      true,
      false,
      true
    ],
    "_id": "1"
  } as const;

  async function setupDB() {
    try {
        if (!db) {
            db = new AstraDB(ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_API_ENDPOINT);
            console.log('+ DB is initialized');
        }
    } catch (error) {
        console.error('Error setting up db:', error);
    }   
  }


console.log("EndPoint "+ ASTRA_DB_API_ENDPOINT)

async function setupCollection() {
    try {
        if (!collection_simple && db!=null) {
            // Collections initializations (typed)
            collection_simple = await db.createCollection('collection_simple');
            console.log('+ Collection ' + collection_simple.name + ' created (if needed)');
        }
        if (collection_simple) {
          // Flush the collection if not null
          await collection_simple.deleteMany({});
          console.log('+ Collection ' + collection_simple.name + ' flushed');
        }
         
    } catch (error) {
        console.error("An error occurred while computing embeddings:", error);
    }
}

async function setupCollectionVector() {
  try {
      if (!collection_vector && db!=null) {
          // Collections initializations (typed)
          collection_vector = await db.createCollection('collection_vector', {
            vector:{
              dimension:14, metric:'cosine'
            }
          });
          console.log('+ Collection ' + collection_vector.name + ' created (if needed)');  
      }
      if (collection_vector) {
        // Flush the collection if not null
        await collection_vector.deleteMany({});
        console.log('+ Collection ' + collection_vector.name + ' flushed');
      }
       
  } catch (error) {
      console.error("An error occurred while computing embeddings:", error);
  }
}

async function insertDocument() {
  if (db != null && collection_simple != null) {
      console.log('Inserting...');
      const resultOne = await collection_simple.insertOne(complete_document);
      console.log('+ One Product inserted id=' + resultOne.insertedId);
  }
}

async function findOneDocument(filter: Filter<SomeDoc>) {
    if (db != null && collection_simple != null) {
        const doc1 = await collection_simple.findOne(filter);
        if (doc1) {
          console.log(JSON.stringify(filter) + " => [OK] Document found: " + doc1._id);
        } else {
          console.log("Document not found !");
        }
    }
}
setupDB()
    .then(() => setupCollection())
    .then(() => insertDocument())
    .then(() => findOneDocument( {"_id": "1"}))
    .then(() => findOneDocument( {"metadata_int":{"$gte":0 }}))
    .then(() => findOneDocument( {"metadata_int":1}))
    .then(() => findOneDocument( {"metadata_int":{"$eq":1 }}))
    .then(() => findOneDocument( {"metadata_int":{"$ne":2 }})) // not equals
    .then(() => findOneDocument( {"metadata_double_array":{"$exists":true }})) // exist
    .then(() => findOneDocument( {"metadata_double_array":{"$size":3 }})) // size
    .then(() => findOneDocument( {"$and":[{"metadata_double_array":{"$exists":true}},{"metadata_int":{"$ne":9.99}}]})) // and
    .then(() => findOneDocument( {"metadata_string":{"$in":["hello","world"]}})) // $in
    .then(() => findOneDocument( {"metadata_string":{"$nin":["Hallo","Welt"]}})) // $nin
    .then(() => findOneDocument( {"metadata_string":{"$xxxx":["Hallo","Welt"]}})) // $nin
    .then(() => findOneDocument( {"metadata_instant":{"$lt":{"$date":1709206498377}}})) // $lt and $date
    .catch((error) => console.error(error)); // Catch any errors in the chain

    