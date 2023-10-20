import { Astra } from "../src/astra";
import { describe, it } from "mocha";
import { expect } from "chai";

const { ASTRA_DB_TOKEN, ASTRA_DB_ID } = process.env;

describe("Astra", () => {
  describe("Namespaces", () => {
    it("should create namespace", async () => {
      const astra = new Astra({
        token: ASTRA_DB_TOKEN,
        databaseId: ASTRA_DB_ID,
        databaseRegion: "us-east1",
      });

      const namespace = await astra.createNamespace("test");
      console.log(namespace);
    });
    it("should find namespaces", async () => {
      const astra = new Astra({
        token: ASTRA_DB_TOKEN,
        databaseId: ASTRA_DB_ID,
        databaseRegion: "us-east1",
      });

      const namespace = await astra.findNamespaces();
      console.log(namespace);
    });
    it("should drop namespace", async () => {
      const astra = new Astra({
        token: ASTRA_DB_TOKEN,
        databaseId: ASTRA_DB_ID,
        databaseRegion: "us-east1",
      });

      const namespace = await astra.dropNamespace("blah");
      console.log(namespace);
    });

    it("should create collection", async () => {
      const astra = new Astra({
        token: ASTRA_DB_TOKEN,
        databaseId: ASTRA_DB_ID,
        databaseRegion: "us-east1",
      });

      const collection = await astra.createCollection("test", "blah");
      console.log(collection);
    });

    it("should find collections", async () => {
      const astra = new Astra({
        token: ASTRA_DB_TOKEN,
        databaseId: ASTRA_DB_ID,
        databaseRegion: "us-east1",
      });

      const collection = await astra.findCollections("test");
      console.log(collection);
    });

    it.only("should delete collection", async () => {
      const astra = new Astra({
        token: ASTRA_DB_TOKEN,
        databaseId: ASTRA_DB_ID,
        databaseRegion: "us-east1",
      });

      const collection = await astra.deleteCollection("test", "blah");
      expect(collection.status.ok).to.equal(1);
    });
  });
});
