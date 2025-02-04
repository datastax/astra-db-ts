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
// noinspection JSDeprecatedSymbols

import { describe, it } from '@/tests/testlib/index.js';
import { UnexpectedDataAPIResponseError } from '@/src/client/index.js';
import assert from 'assert';

describe('unit.client.errors', () => {
  describe('UnexpectedDataAPIResponseError', () => {
    it('constructs', () => {
      const message = 'message';
      const error1 = new UnexpectedDataAPIResponseError(message, { resp: 30 });
      const error2 = new UnexpectedDataAPIResponseError(message, { resp: 3n });

      assert.strictEqual(error1.message, `${message}\n\nRaw Data API response: {"resp":30}`);
      assert.strictEqual(error2.message, `${message}\n\nRaw Data API response: [object Object]`);

      assert.strictEqual(error1.name, 'UnexpectedDataAPIResponseError');
      assert.strictEqual(error2.name, 'UnexpectedDataAPIResponseError');

      assert.deepStrictEqual(error1.rawDataAPIResponse, { resp: 30 });
      assert.deepStrictEqual(error2.rawDataAPIResponse, { resp: 3n });
    });

    it('requires', () => {
      assert.throws(() => UnexpectedDataAPIResponseError.require(null, '', {}), UnexpectedDataAPIResponseError);
      assert.throws(() => UnexpectedDataAPIResponseError.require(undefined, '', {}), UnexpectedDataAPIResponseError);

      assert.strictEqual(UnexpectedDataAPIResponseError.require(false, '', {}), false);
      assert.strictEqual(UnexpectedDataAPIResponseError.require(12345, '', {}), 12345);
    });
  });
});
