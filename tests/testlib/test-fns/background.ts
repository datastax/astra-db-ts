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

import { initTestObjects } from '@/tests/testlib/fixtures.js';
import { checkTestsEnabled, tryCatchErrAsync } from '@/tests/testlib/utils.js';
import type { SuiteBlock } from '@/tests/testlib/index.js';
import { CURRENT_DESCRIBE_NAMES } from '@/tests/testlib/index.js';
import type { AsyncSuiteResult, AsyncSuiteSpec, GlobalAsyncSuitesSpec } from '@/tests/testlib/test-fns/types.js';
import { UUID } from '@/src/documents/index.js';

export const backgroundTestState: GlobalAsyncSuitesSpec = {
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
  name = `{background} ${name}`;

  before(function () {
    this.timeout(0);

    const suite: AsyncSuiteSpec = {
      name: name,
      skipped: !checkTestsEnabled(name),
      tests: [],
    };

    backgroundTestState.suites.push(suite);

    CURRENT_DESCRIBE_NAMES.push(name);
    backgroundTestState.inBlock = true;
    suiteFn(initTestObjects());
    backgroundTestState.inBlock = false;
    CURRENT_DESCRIBE_NAMES.pop();

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
        const uuids = Array.from({ length: test.testFn.length }, () => UUID.v4().toString());

        arr.push({
          error: await tryCatchErrAsync(() => test.testFn(...uuids)),
          ms: performance.now() - startTime,
        });

        return arr;
      });
    });

    backgroundTestResults.push(promise);
  });
};
