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

import assert from "assert";
import { HTTPClient } from "@/src/api/http-client";

describe("Astra TS Client - client.HTTPClient", () => {
  describe("HTTPClient Operations", () => {
    it("should not initialize in a web browser", () => {
      let error: any;
      try {
        // @ts-expect-error - Testing in browser environment
        window = true;
        // @ts-expect-error - Testing in browser environment
        const client = new HTTPClient();
        assert.ok(client);
      } catch (e) {
        error = e;
      }
      assert.ok(error);
    });
    it("should not initialize without an application token", () => {
      let error: any;
      try {
        // @ts-expect-error - Testing without required args
        const client = new HTTPClient({});
        assert.ok(client);
      } catch (e) {
        error = e;
      }
      assert.ok(error);
    });
    it("should not initialize without a baseUrl or both database settings", () => {
      let error: any;
      try {
        // @ts-expect-error - Testing without required args
        const client = new HTTPClient({});
        assert.ok(client);
      } catch (e) {
        error = e;
      }
      assert.ok(error);
    });
  });
});