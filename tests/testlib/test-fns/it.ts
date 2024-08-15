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
/* eslint-disable prefer-const */

import { checkTestsEnabled } from '@/tests/testlib/utils';
import { parallelTestState } from '@/tests/testlib/test-fns/parallel';
import { CURRENT_DESCRIBE_NAMES } from '@/tests/testlib/global';
import { DEFAULT_TEST_TIMEOUT } from '@/tests/testlib/config';
import { UUID } from '@/src/data-api';
import { backgroundTestState, TEST_FILTER } from '@/tests/testlib';

export type TestFn = SyncTestFn | AsyncTestFn;

type SyncTestFn = (key: string) => void;
type AsyncTestFn = (key: string) => Promise<void>;

interface TaggableTestFunction {
  (name: string, fn: SyncTestFn): Mocha.Test | null;
  (name: string, fn: AsyncTestFn): Mocha.Test | null;
}

export let it: TaggableTestFunction;

// const nonstandardItProxy = new Proxy({}, {
//   get() { throw new Error('Can not use return type of `it` when in a parallel/background block') },
// });

it = function (name: string, testFn: TestFn) {
  const skipped = !checkTestsEnabled(name);

  for (const asyncTestState of [parallelTestState, backgroundTestState]) {
    if (asyncTestState.inBlock) {
      asyncTestState.it(name, testFn, skipped);
      return null;
    }
  }

  if (!TEST_FILTER.test(name, ...CURRENT_DESCRIBE_NAMES)) {
    return null;
  }

  function modifiedFn(this: Mocha.Context) {
    skipped && this.skip();
    this.timeout(DEFAULT_TEST_TIMEOUT);
    return testFn(UUID.v4().toString());
  }

  return global.it(name, modifiedFn);
}
