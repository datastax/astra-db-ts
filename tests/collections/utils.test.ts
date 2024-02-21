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
import { createAstraUri } from '@/src/collections/utils';
import { AstraDB } from '@/src/collections';

describe("Utils test", () => {
  it("ClientBaseUriTest", () => {
    const apiEndPoint = "https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com";
    const astraDb = new AstraDB("myToken",apiEndPoint,"testks1");
    assert.strictEqual(
        astraDb.httpClient.baseUrl,
        "https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com/api/json/v1/testks1",
    );
  });

  it("ClientBaseUriTestDefaultKeyspace", () => {
    const apiEndPoint = "https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com";
    const astraDb = new AstraDB("myToken",apiEndPoint);
    assert.strictEqual(
        astraDb.httpClient.baseUrl,
        "https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com/api/json/v1/default_keyspace",
    );
  });

  it("createProdAstraUri", () => {
    const apiEndPoint = "https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com";
    const uri: string = createAstraUri( apiEndPoint, "testks1");
    assert.strictEqual(
      uri,
      "https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com/api/json/v1/testks1",
    );
  });

  it("createProdAstraUriWithToken", () => {
    const apiEndPoint = "https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com";
    const uri: string = createAstraUri( apiEndPoint, "testks1", "myToken");
    assert.strictEqual(
        uri,
        "https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com/api/json/v1/testks1?applicationToken=myToken",
    );
  });

  it("createProdAstraUriWithTokenAndProdEnum", () => {
      const apiEndPoint = "https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com";
      const uri: string = createAstraUri( apiEndPoint, "testks1", "myToken");
      assert.strictEqual(
          uri,
          "https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com/api/json/v1/testks1?applicationToken=myToken",
      );
    });

  it("createProdAstraUriWithTokenAndProdEnumWithBaseAPIPath", () => {
    const apiEndPoint = "https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com";
    const uri: string = createAstraUri( apiEndPoint, "testks1", "myToken","apis");
    assert.strictEqual(
        uri,
        "https://a5cf1913-b80b-4f44-ab9f-a8b1c98469d0-ap-south-1.apps.astra.datastax.com/apis/testks1?applicationToken=myToken",
    );
  });
});
