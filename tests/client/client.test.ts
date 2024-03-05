// Copyright DataStax, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import assert from 'assert';
import { Client } from '@/src/client/client';
import { testClient, useHttpClient } from '@/tests/fixtures';
import { parseUri } from '@/src/client/utils';

const localBaseUrl = "http://localhost:8181";

describe("Client test", () => {
  const baseUrl = "https://db_id-region-1.apps.astra.datastax.com";

  let appClient: Client | null;
  let clientURI: string;

  before(async function () {
    if (testClient == null) {
      return this.skip();
    }

    appClient = await testClient.new();

    if (appClient == null) {
      return this.skip();
    }

    clientURI = testClient.uri;
  });

  describe("Client Connections", () => {
    it("should initialize a Client connection with a uri using connect", async () => {
      assert.ok(appClient);
    });

    it("should not a Client connection with an invalid uri", async () => {
      let error: any;
      try {
        const badClient = await Client.connect("invaliduri");
        assert.ok(badClient);
      } catch (e) {
        error = e;
      }
      assert.ok(error);
    });

    it("should have unique httpClients for each db", async () => {
      const dbFromUri = appClient?.db();
      const parsedUri = parseUri(clientURI);
      assert.strictEqual(dbFromUri?.namespace, parsedUri.keyspaceName);
      const newDb = appClient?.db("test-db");
      assert.strictEqual(newDb?.namespace, "test-db");
    });

    it("should initialize a Client connection with a uri using connect with overrides", async () => {
      const AUTH_TOKEN_TO_CHECK = "123";
      const BASE_API_PATH_TO_CHECK = "baseAPIPath1";
      using client = await Client.connect(clientURI, {
        applicationToken: AUTH_TOKEN_TO_CHECK,
        baseApiPath: BASE_API_PATH_TO_CHECK,
      });
      assert.ok(client);
      assert.ok(useHttpClient(client));
      assert.strictEqual(
        useHttpClient(client).applicationToken,
        AUTH_TOKEN_TO_CHECK,
      );
      assert.strictEqual(client.namespace, parseUri(clientURI).keyspaceName);
      assert.strictEqual(
        useHttpClient(client).baseUrl,
        parseUri(clientURI).baseUrl + "/" + BASE_API_PATH_TO_CHECK,
      );
      const db = client.db();
      assert.ok(db);
    });

    it("should parse baseApiPath from URL when possible", async () => {
      const AUTH_TOKEN_TO_CHECK = "123";
      const KEYSPACE_TO_CHECK = "testks1";
      const BASE_API_PATH_TO_CHECK = "baseAPIPath1";
      using client = await Client.connect(
        parseUri(clientURI).baseUrl + "/" + BASE_API_PATH_TO_CHECK + "/" + KEYSPACE_TO_CHECK,
        {
          applicationToken: AUTH_TOKEN_TO_CHECK,
        },
      );
      assert.ok(client);
      assert.ok(useHttpClient(client));
      assert.strictEqual(
        useHttpClient(client).applicationToken,
        AUTH_TOKEN_TO_CHECK,
      );
      assert.strictEqual(client.namespace, KEYSPACE_TO_CHECK);
      assert.strictEqual(
        useHttpClient(client).baseUrl,
        parseUri(clientURI).baseUrl + "/" + BASE_API_PATH_TO_CHECK,
      );
      const db = client.db();
      assert.ok(db);
    });

    it("should parse baseApiPath from URL when possible (multiple path elements)", async () => {
      const AUTH_TOKEN_TO_CHECK = "123";
      const KEYSPACE_TO_CHECK = "testks1";
      const BASE_API_PATH_TO_CHECK = "apis/baseAPIPath1";
      using client = await Client.connect(
        parseUri(clientURI).baseUrl + "/" + BASE_API_PATH_TO_CHECK + "/" + KEYSPACE_TO_CHECK,
        {
          applicationToken: AUTH_TOKEN_TO_CHECK,
        },
      );
      assert.ok(client);
      assert.ok(useHttpClient(client));
      assert.strictEqual(useHttpClient(client).applicationToken, AUTH_TOKEN_TO_CHECK);
      assert.strictEqual(client.namespace, KEYSPACE_TO_CHECK);
      assert.strictEqual(useHttpClient(client).baseUrl, parseUri(clientURI).baseUrl + "/" + BASE_API_PATH_TO_CHECK);
      const db = client.db();
      assert.ok(db);
    });

    it("should handle when the keyspace name is present in the baseApiPath also", async () => {
      //only the last occurrence of the keyspace name in the url path must be treated as keyspace
      //other parts of it should be simply be treated as baseApiPath
      const AUTH_TOKEN_TO_CHECK = "123";
      const KEYSPACE_TO_CHECK = "testks1";
      const BASE_API_PATH_TO_CHECK = "baseAPIPath1";
      const baseUrl = localBaseUrl;
      using client = await Client.connect(
        baseUrl + "/testks1/" + BASE_API_PATH_TO_CHECK + "/" + KEYSPACE_TO_CHECK,
        {
          applicationToken: AUTH_TOKEN_TO_CHECK,
        },
      );
      assert.ok(client);
      assert.ok(useHttpClient(client));
      assert.strictEqual(useHttpClient(client).applicationToken, AUTH_TOKEN_TO_CHECK);
      assert.strictEqual(client.namespace, KEYSPACE_TO_CHECK);
      assert.strictEqual(
        useHttpClient(client).baseUrl,
        baseUrl + "/testks1/" + BASE_API_PATH_TO_CHECK,
      );
      const db = client.db();
      assert.ok(db);
    });

    it("should honor the baseApiPath from options when provided", async () => {
      const AUTH_TOKEN_TO_CHECK = "123";
      const KEYSPACE_TO_CHECK = "testks1";
      const BASE_API_PATH_TO_CHECK = "baseAPIPath1";
      const baseUrl = localBaseUrl;
      using client = await Client.connect(
        baseUrl + "/" + BASE_API_PATH_TO_CHECK + "/" + KEYSPACE_TO_CHECK,
        {
          applicationToken: AUTH_TOKEN_TO_CHECK,
          baseApiPath: "baseAPIPath2",
        },
      );
      assert.ok(client);
      assert.ok(useHttpClient(client));
      assert.strictEqual(useHttpClient(client).applicationToken, AUTH_TOKEN_TO_CHECK);
      assert.strictEqual(client.namespace, KEYSPACE_TO_CHECK);
      assert.strictEqual(useHttpClient(client).baseUrl, baseUrl + "/baseAPIPath2");
      const db = client.db();
      assert.ok(db);
    });

    it("should handle empty baseApiPath", async () => {
      const AUTH_TOKEN_TO_CHECK = "123";
      const KEYSPACE_TO_CHECK = "testks1";

      using client = await Client.connect(baseUrl + "/" + KEYSPACE_TO_CHECK, {
        applicationToken: AUTH_TOKEN_TO_CHECK,
      });

      assert.ok(client);
      assert.ok(useHttpClient(client));
      assert.strictEqual(useHttpClient(client).applicationToken, AUTH_TOKEN_TO_CHECK);
      assert.strictEqual(client.namespace, KEYSPACE_TO_CHECK);
      assert.strictEqual(useHttpClient(client).baseUrl, baseUrl);
      const db = client.db();
      assert.ok(db);
    });

    it("should initialize a Client connection with a uri using the constructor", () => {
      using client = new Client(baseUrl, "keyspace1", {
        applicationToken: "123",
      });
      assert.ok(client);
    });

    it("should not initialize a Client connection with a uri using the constructor with no options", () => {
      let error: any;
      try {
        // @ts-expect-error - Intentionally passing no options
        const client = new Client(baseUrl, "keyspace1");
        assert.ok(client);
      } catch (e) {
        error = e;
      }
      assert.ok(error);
    });

    it("should initialize a Client connection with a uri using the constructor and a keyspace", () => {
      using client = new Client(baseUrl, "keyspace1", {
        applicationToken: "123",
      });
      assert.ok(client.namespace);
    });

    it("should connect after setting up the client with a constructor", async () => {
      using client = new Client(baseUrl, "keyspace1", {
        applicationToken: "123",
      });
      assert.ok(client);
      assert.ok(useHttpClient(client));
    });

    it("should set the auth header name as set in the options", async () => {
      using client = new Client(baseUrl, "keyspace1", {
        applicationToken: "123",
      });
      assert.ok(client);
    });

    it('automatically disconnects when out of scope w/ ERM', async () => {
      let client: Client;
      {
        using _client = new Client(baseUrl, 'keyspace1', {
          applicationToken: '123',
          useHttp2: true,
        });
        assert.ok(_client);
        client = _client;
      }
      let error: any;
      try {
        await client.db('test')!.collection('test')!.findOne({
          url: '/test'
        });
        assert.ok(false);
      } catch (e) {
        error = e;
      }
      assert.ok(error);
      assert.ok(error.message.includes('Cannot make http2 request when client is closed'), error.message);
    });
  });

  describe("Client Db operations", () => {
    it("should return a db after setting up the client with a constructor", async () => {
      using client = new Client(baseUrl, "keyspace1", {
        applicationToken: "123",
      });
      const db = client.db("keyspace1");
      assert.ok(db);
    });

    it("should not return a db if no name is provided", async () => {
      using client = new Client(baseUrl, "keyspace1", {
        applicationToken: "123",
      });
      let error: any;
      try {
        client.db();
        assert.ok(false);
      } catch (e) {
        error = e;
      }
      assert.ok(error);
    });

    it('close() should close HTTP client', async () => {
      const client = new Client(baseUrl, 'keyspace1', {
        applicationToken: '123',
        useHttp2: true
      });

      assert.ok(!useHttpClient(client).isClosed());

      client.close();
      assert.ok(useHttpClient(client).isClosed());

      client.close();
      assert.ok(useHttpClient(client).isClosed());

      let error: any;
      try {
        await client.db('test')!.collection('test')!.findOne({
          url: '/test'
        });
        assert.ok(false);
      } catch (e) {
        error = e;
      }

      assert.ok(error);
      assert.ok(error.message.includes('Cannot make http2 request when client is closed'), error.message);
    });
  });

  describe("Client noops", () => {
    it("should handle noop: setMaxListeners", async () => {
      const maxListeners = appClient?.setMaxListeners(1);
      assert.strictEqual(maxListeners, 1);
    });

    it("should handle noop: close", async () => {
      const closedClient = appClient?.close();
      assert.ok(closedClient);
    });
  });
});
