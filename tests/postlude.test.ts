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

import { backgroundTestResults, backgroundTestState, describe } from '@/tests/testlib';
import { AsyncSuiteResult } from '@/tests/testlib/test-fns/types';

describe('(dummy)', () => {
  before(async () => {
    backgroundTestState.suites.forEach((suite, suiteIdx) => {
      describe(suite.name!, () => {
        let results: AsyncSuiteResult;
        let waited: number;

        before(async function () {
          suite.skipped && this.skip();

          const time = performance.now();
          results = await backgroundTestResults[suiteIdx];
          waited = performance.now() - time;
        });

        suite.tests.forEach((test, testIdx) => {
          global.it(test.name, function () {
            if (testIdx === 0) {
              this.test!.title += ` (waited ${~~waited}ms)`;
            }

            if (test.skipped) {
              this.skip();
            }

            const result = results[testIdx]!;

            this.test!.title += ` (${~~result.ms}ms)`;

            if (result.error) {
              throw result.error;
            }
          });
        });
      });
    });
  });
  global.it('Dummy test that always runs', () => {});
});
