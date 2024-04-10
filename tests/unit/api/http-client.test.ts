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
import { HttpClient } from '@/src/api/http-client';

describe('unit.api.http-client', () => {
  describe('HTTPClient Operations', () => {
    it('should not initialize in a web browser', () => {
      let error: any;
      try {
        // @ts-expect-error - Testing in browser environment
        window = true;
        // @ts-expect-error - Testing in browser environment
        const client = new HttpClient();
        assert.ok(client);
      } catch (e) {
        error = e;
      }
      assert.ok(error);
    });

    // it('should not initialize without an application token', () => {
    //   let error: any;
    //   try {
    //     // @ts-expect-error - Testing without required args
    //     const client = new HttpClient({ baseUrl: 'https://localhost:3000' });
    //     assert.ok(client);
    //   } catch (e) {
    //     error = e;
    //   }
    //   assert.ok(error);
    // });

    // it('should not initialize without a baseUrl or both database settings', () => {
    //   let error: any;
    //   try {
    //     // @ts-expect-error - Testing without required args
    //     const client = new HttpClient({});
    //     assert.ok(client);
    //   } catch (e) {
    //     error = e;
    //   }
    //   assert.ok(error);
    // });

    // it('should not initialize if window is set', () => {
    //   let error: any;
    //   try {
    //     // @ts-expect-error - Testing in browser environment
    //     window = true;
    //     // @ts-expect-error - Testing without required args
    //     const client = new HttpClient({});
    //     assert.ok(client);
    //   } catch (e) {
    //     console.error(e);
    //     error = e;
    //   }
    //   assert.ok(error);
    // });
  });

  // describe('Caller tests', () => {
  //   it('should use REQUESTED_WITH as the default user agent', () => {
  //     const client = new HttpClient({
  //       applicationToken: 'token',
  //       baseUrl: 'http://localhost:8080',
  //       monitorCommands: false,
  //       emitter: null!
  //     });
  //
  //     assert.equal(client.userAgent, CLIENT_USER_AGENT);
  //   });
  //
  //   it('should use the provided user agent', () => {
  //     const client = new HttpClient({
  //       applicationToken: 'token',
  //       baseUrl: 'http://localhost:8080',
  //       caller: ['my-app', '1.0.0'],
  //       monitorCommands: false,
  //       emitter: null!
  //     });
  //
  //     assert.equal(client.userAgent, `my-app/1.0.0 ${CLIENT_USER_AGENT}`);
  //   });
  //
  //   it('should use the provided user agents', () => {
  //     const client = new HttpClient({
  //       applicationToken: 'token',
  //       baseUrl: 'http://localhost:8080',
  //       caller: [['my-app', '1.0.0'], ['my-other-app']],
  //       monitorCommands: false,
  //       emitter: null!
  //     });
  //
  //     assert.equal(client.userAgent, `my-app/1.0.0 my-other-app ${CLIENT_USER_AGENT}`);
  //   });
  // });
});
