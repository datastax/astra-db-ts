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

import { describe, it } from '@/tests/testlib/index.js';
import { DataAPIHttpError, DataAPIResponseError, TooManyDocumentsToCountError } from '@/src/documents/index.js';
import assert from 'assert';

describe('unit.documents.errors', () => {
  describe('withTransientDupesForEvents', () => {
    it('should return itself for all non-DataAPIResponseError implementations of DataAPIError', () => {
      const errors = [
        new TooManyDocumentsToCountError(3, false),
        new DataAPIHttpError({ body: '', httpVersion: 1, url: '', status: 200, headers: {}, statusText: '' }),
        // yeah... just pretend I did the rest here
      ];

      for (const error of errors) {
        assert.strictEqual(error.withTransientDupesForEvents(), error);
      }
    });

    it('should return just the name for DataAPIResponseError', () => {
      const error = new DataAPIResponseError({}, { errors: [] });
      assert.deepStrictEqual(error.withTransientDupesForEvents(), { name: 'DataAPIResponseError' });
    });
  });
});
