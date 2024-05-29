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
// noinspection DuplicatedCode

import assert from 'assert';
import { DevOpsAPIResponseError } from '@/src/devops';
import { FetcherResponseInfo } from '@/src/api';

describe('unit.devops.errors', () => {
  describe('DevOpsAPIResponseError construction', () => {
    const rootError: FetcherResponseInfo = {
      status: 500,
      headers: { 'content-type': 'application/json' },
      url: 'http://localhost:8080',
      body: '{ "body": true }',
      httpVersion: 1,
      statusText: 'Internal Server Error',
    };

    it('should properly construct a DevOpsAPIResponseError with no underlying errors given', () => {
      const err = new DevOpsAPIResponseError(rootError, {});
      assert.strictEqual(err.message, 'Something went wrong');
      assert.deepStrictEqual(err.errors, []);
      assert.strictEqual(err.status, 500);
      assert.strictEqual(err.name, 'DevOpsAPIResponseError');
      assert.strictEqual(err.raw.status, 500);
      assert.strictEqual(err.raw.headers['content-type'], 'application/json');
      assert.strictEqual(err.raw.httpVersion, 1);
    });

    it('should properly construct a DevOpsAPIResponseError with no underlying errors given + undefined data', () => {
      const err = new DevOpsAPIResponseError(rootError, undefined);
      assert.strictEqual(err.message, 'Something went wrong');
      assert.deepStrictEqual(err.errors, []);
      assert.strictEqual(err.status, 500);
      assert.strictEqual(err.name, 'DevOpsAPIResponseError');
      assert.strictEqual(err.raw.status, 500);
      assert.strictEqual(err.raw.headers['content-type'], 'application/json');
      assert.strictEqual(err.raw.httpVersion, 1);
    });

    it('should properly construct a DevOpsAPIResponseError with underlying errors', () => {
      const data = {
        errors: [
          { ID: 1 },
          { ID: 2, message: 'Error 2' },
        ],
      };

      const err = new DevOpsAPIResponseError(rootError, data);
      assert.strictEqual(err.message, 'Error 2');
      assert.deepStrictEqual(err.errors, [{ id: 1, message: undefined }, { id: 2, message: 'Error 2' }]);
      assert.strictEqual(err.status, 500);
      assert.strictEqual(err.name, 'DevOpsAPIResponseError');
      assert.strictEqual(err.raw.status, 500);
      assert.strictEqual(err.raw.headers['content-type'], 'application/json');
      assert.strictEqual(err.raw.httpVersion, 1);
    });
  });
});
