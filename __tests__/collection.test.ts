import { Astra } from "../src/astra";
import { describe, test } from "mocha";
import { expect } from "chai";

const { ASTRA_DB_TOKEN, ASTRA_DB_ID } = process.env;
const epoch =  new Date().getTime();

describe("Collections", () => {
  let astra;
  before(async () => {
    astra = new Astra({
      token: ASTRA_DB_TOKEN,
      databaseId: ASTRA_DB_ID,
      databaseRegion: "us-east1",
      namespace: "test",
    });
  })
  describe("Namespaces", () => {
    test("should create collection", async () => {
      const collectionName = `test${epoch}`;
      const results = await astra.createCollection({ name: collectionName });
      console.log(results)
      expect(results.status.ok).to.equal(1);
      await astra.deleteCollection({ name: collectionName });
    });
    test("should count collection results", async () => {
      const collectionName = `test${epoch}`;
      const results = await astra.createCollection({ name: collectionName });
      const countResults = await astra
        .collection("test")
        .countDocuments();
      expect(countResults.status.count).to.be.greaterThan(0);
      await astra.deleteCollection({ name: collectionName });
    });
    test("should insert one", async () => {
      const collectionName = `test${epoch}`;
      await astra.createCollection({ name: collectionName });
      const insertResults = await astra.collection(collectionName).insertOne({
        document: {
          name: "Alex",
          age: 31,
        },
      });
      expect(insertResults.status.insertedIds).length.to.be.greaterThan(0);
      await astra.deleteCollection({ name: collectionName });
    });
    test("should insert many", async () => {
      const collectionName = `test${epoch}`;
      await astra.createCollection({ name: collectionName });
      const insertResults = await astra.collection(collectionName).insertMany({
        documents: [{
          name: "Alex",
          age: 31,
        }, {
          name: "Claire",
          age: 31,
        }],
      });
      expect(insertResults.status.insertedIds).length.to.have.length(2);
      await astra.deleteCollection({ name: collectionName });
    });
    test("should update one", async () => {
      const collectionName = `test${epoch}`;
      await astra.createCollection({ name: collectionName });
      const insertResults = await astra.collection(collectionName).insertOne({
        document: {
          name: "Alex",
          age: 1,
        }
      });
      const updateResults = await astra.collection(collectionName).updateOne({
        filter: {
          name: "Alex",
        },
        update: {
          '$set': {
            age: 2,
          }
        }
      });
      console.log(updateResults);
      // expect(insertResults.status.insertedIds).length.to.have.length(2);
      // await astra.deleteCollection({ name: collectionName });
    });
  });
});
