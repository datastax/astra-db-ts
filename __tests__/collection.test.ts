import { Astra } from "../src/astra";
import { describe, test } from "mocha";
import { expect } from "chai";

const { ASTRA_DB_TOKEN, ASTRA_DB_ID } = process.env;

describe.only("Collections", () => {
  describe("Namespaces", () => {
    test("should create collection", async () => {
      const astra = new Astra({
        token: ASTRA_DB_TOKEN,
        databaseId: ASTRA_DB_ID,
        databaseRegion: "us-east1",
        namespace: "test",
      });

      const results = await astra.createCollection({collectionName: "test"});
      const countResults = await astra
        .collection("test")
        .countDocuments("test");
      expect(countResults.status.count).to.be.greaterThan(0);
    });
  });
});
