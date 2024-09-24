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

import { it, parallel } from '@/tests/testlib';
import { FetchH2 } from '@/src/lib/api';
import assert from 'assert';
import { FailedToLoadDefaultClientError } from '@/src/client';

parallel('unit.api.fetch.fetch-h2', () => {
  it('should error if non-module explicit fetchH2 passed', async () => {
    try {
      new FetchH2({ fetchH2: 3 }, false);
      assert.fail('Expected error');
    } catch (e) {
      assert.ok(e instanceof FailedToLoadDefaultClientError);
      assert.ok(<any>e.rootCause instanceof TypeError);
      assert.strictEqual(e.message, 'Error loading the fetch-h2 client for the DataAPIClient... please check the "Non-standard environment support" section of https://github.com/datastax/astra-db-ts for more information.');
      assert.strictEqual(e.rootCause.message, 'fetchH2 must be an object—did you pass in the module correctly?');
    }
  });

  it('should error if invalid explicit fetchH2 module passed', async () => {
    try {
      new FetchH2({ fetchH2: {} }, false);
      assert.fail('Expected error');
    } catch (e) {
      assert.ok(e instanceof FailedToLoadDefaultClientError);
      assert.ok(<any>e.rootCause instanceof TypeError);
      assert.strictEqual(e.message, 'Error loading the fetch-h2 client for the DataAPIClient... please check the "Non-standard environment support" section of https://github.com/datastax/astra-db-ts for more information.');
      assert.strictEqual(e.rootCause.message, 'fetchH2 missing the required \'context\' property');
    }
  });

  it('should not error if explicit fetchH2 module passed is very roughly ok', async () => {
    assert.ok(new FetchH2({ fetchH2: { context: () => {}, TimeoutError: null } }, false));
  });
});
