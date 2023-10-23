import { Astra } from "../src/astra";
import { describe, test } from "mocha";
import { expect } from "chai";

const { ASTRA_DB_TOKEN, ASTRA_DB_ID } = process.env;

describe("Collections", () => {
  describe("Namespaces", () => {
    test("should create collection", async () => {
      const astra = new Astra({
        token: ASTRA_DB_TOKEN,
        databaseId: ASTRA_DB_ID,
        databaseRegion: "us-east1",
        namespace: "test",
      });

      const results = await astra.createCollection({ name: "test" });
      const countResults = await astra
        .collection("test")
        .countDocuments();
      expect(countResults.status.count).to.be.greaterThan(0);
    });
  });
});
