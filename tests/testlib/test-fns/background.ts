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

import { initTestObjects } from '@/tests/testlib/fixtures';
import { checkTestsEnabled, tryCatchErr } from '@/tests/testlib/utils';
import { SuiteBlock, TESTS_FILTER } from '@/tests/testlib';
import { AsyncSuiteResult, AsyncSuiteSpec, GlobalAsyncSuiteSpec } from '@/tests/testlib/test-fns/types';
import { UUID } from '@/src/data-api';

export const backgroundTestState: GlobalAsyncSuiteSpec = {
  inBlock: false,
  suites: [],
  describe() {
    throw new Error('Can\'t use `describe` in `background` blocks');
  },
  it(name, testFn, skipped) {
    this.suites.at(-1)!.tests.push({ name, testFn, skipped });
  },
};

export const backgroundTestResults: Promise<AsyncSuiteResult>[] = [];

interface BackgroundTestsBlock {
  (name: string, fn: SuiteBlock): void;
  (name: string, fn: SuiteBlock): void;
}

export let background: BackgroundTestsBlock;

background = function (name: string, suiteFn: SuiteBlock) {
  before(function () {
    this.timeout(0);

    const suite: AsyncSuiteSpec = {
      name: name,
      skipped: !checkTestsEnabled(name),
      tests: [],
    };

    backgroundTestState.suites.push(suite);

    backgroundTestState.inBlock = true;
    suiteFn(initTestObjects());
    backgroundTestState.inBlock = false;

    suite.tests = suite.tests.filter(t => TESTS_FILTER.test(suite.name!) || TESTS_FILTER.test(t.name));

    if (!suite.tests.length) {
      backgroundTestState.suites.pop();
      return;
    }

    let promise = Promise.resolve<AsyncSuiteResult>([]);

    suite.tests.forEach((test) => {
      promise = promise.then(async (arr) => {
        if (suite.skipped || test.skipped) {
          arr.push(null);
          return arr;
        }

        const startTime = performance.now();

        arr.push({
          error: await tryCatchErr(() => test.testFn(UUID.v4().toString())),
          ms: performance.now() - startTime,
        });

        return arr;
      })
    });

    backgroundTestResults.push(promise);
  });
}
