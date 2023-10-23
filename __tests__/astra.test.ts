import { Astra } from "../src/astra";
import { describe, test } from "mocha";
import { expect } from "chai";

const { ASTRA_DB_TOKEN, ASTRA_DB_ID } = process.env;

describe("Astra", () => {
  describe("Collections", () => {
    test("should create collection", async () => {
      const astra = new Astra({
        token: ASTRA_DB_TOKEN,
        databaseId: ASTRA_DB_ID,
        databaseRegion: "us-east1",
        namespace: "test",
      });

      const results = await astra.createCollection({ name: "blah" });
      expect(results.status.ok).to.equal(1);
    });

    test("should create vector collection", async () => {
      const astra = new Astra({
        token: ASTRA_DB_TOKEN,
        databaseId: ASTRA_DB_ID,
        databaseRegion: "us-east1",
        namespace: "test",
      });

      const results = await astra.createCollection({
        name: "blahs",
        options: {
          vector: {
            size: 2,
            function: "cosine",
          },
        },
      });
      expect(results.status.ok).to.equal(1);
    });

    test("should find collections", async () => {
      const astra = new Astra({
        token: ASTRA_DB_TOKEN,
        databaseId: ASTRA_DB_ID,
        databaseRegion: "us-east1",
        namespace: "test",
      });

      const results = await astra.findCollections();
      expect(results.status.collections[0]).to.equal("blah");
    });

    test("should delete collection that doesn't exist", async () => {
      const astra = new Astra({
        token: ASTRA_DB_TOKEN,
        databaseId: ASTRA_DB_ID,
        databaseRegion: "us-east1",
        namespace: "test",
      });

      const collection = await astra.deleteCollection({name: "bah"});
      expect(collection.status.ok).to.equal(1);
    });
  });
});
