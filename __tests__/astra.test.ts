import { Astra } from "../src/astra";
import { describe, test } from "mocha";
import { expect } from "chai";

const { ASTRA_DB_TOKEN, ASTRA_DB_ID } = process.env;
const epoch = new Date().getTime();

describe("Astra", () => {
  let astra;
  before(async () => {
    astra = new Astra({
      token: ASTRA_DB_TOKEN,
      databaseId: ASTRA_DB_ID,
      databaseRegion: "us-east1",
      namespace: "test",
    });
  })
  describe("Collections", () => {
    test("should create collection", async () => {
      const collectionName = `test${epoch}`;
      const results = await astra.createCollection({ name: collectionName });
      expect(results.status.ok).to.equal(1);
      await astra.deleteCollection({ name: collectionName });
    });

    test("should create vector collection", async () => {
      const collectionName = `test${epoch}`;
      const results = await astra.createCollection({
        name: collectionName,
        options: {
          vector: {
            size: 2,
            function: "cosine",
          },
        },
      });
      expect(results.status.ok).to.equal(1);
      await astra.deleteCollection({ name: collectionName });
    });

    test("should find collections", async () => {
      const collectionName = `test${epoch}`;
      await astra.createCollection({
        name: collectionName,
        options: {
          vector: {
            size: 2,
            function: "cosine",
          },
        },
      });
      const results = await astra.findCollections();
      expect(results.status.collections[0]).to.equal(collectionName);
      await astra.deleteCollection({ name: collectionName });
    });

    test("should delete collection that doesn't exist", async () => {
      const collection = await astra.deleteCollection({ name: "bah" });
      expect(collection.status.ok).to.equal(1);
    });
  });
});
