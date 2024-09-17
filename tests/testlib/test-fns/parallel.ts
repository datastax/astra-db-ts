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
import { afterEach } from 'mocha';
import { tryCatchErr } from '@/tests/testlib/utils';
import {
  CURRENT_DESCRIBE_NAMES,
  describe,
  SuiteBlock,
  SuiteOptions,
  TEST_FILTER,
} from '@/tests/testlib';
import { UUID } from '@/src/data-api';
import { AsyncSuiteResult, GlobalAsyncSuiteSpec } from '@/tests/testlib/test-fns/types';

const mkDefaultSuite = () => ({ name: undefined, skipped: false, tests: [] });

export const parallelTestState: GlobalAsyncSuiteSpec  = {
  suites: [mkDefaultSuite()],
  inBlock: false,
  describe(name, fn, opts, skipped, fixtures) {
    if (this.suites.at(-1)?.name) {
      throw new Error('`describe` is not reentrant in `parallel` blocks');
    }

    if (opts) {
      throw new Error('Can not pass `SuiteOptions` to `describe` in `parallel` block');
    }

    this.suites.push({ name: name, skipped, tests: [] });
    fn(fixtures);
    this.suites.push(mkDefaultSuite());

    return null;
  },
  it(name, testFn, skipped) {
    this.suites.at(-1)!.tests.push({ name, testFn, skipped });
  },
};

interface ParallelizedTestsBlock {
  (name: string, fn: SuiteBlock): void;
  (name: string, options: SuiteOptions, fn: SuiteBlock): void;
}

export let parallel: ParallelizedTestsBlock;

parallel = function (name: string, optsOrFn: SuiteOptions | SuiteBlock, maybeFn?: SuiteBlock) {
  name = `{parallel} ${name}`;

  const fn = (!maybeFn)
    ? optsOrFn as SuiteBlock
    : maybeFn;

  const opts = (maybeFn)
    ? optsOrFn as SuiteOptions
    : {};

  function modifiedFn(this: Mocha.Suite, fixtures: ReturnType<typeof initTestObjects>) {
    if (parallelTestState.inBlock) {
      throw new Error('Can\'t nest parallel blocks');
    }

    const [oldBeforeEach, oldAfterEach] = [beforeEach, afterEach];

    global.beforeEach = () => { throw new Error('Can\'t use `beforeEach` in a parallel block'); };
    global.afterEach = () => { throw new Error('Can\'t use `afterEach` in a parallel block'); };

    parallelTestState.inBlock = true;
    fn.call(this, fixtures);
    parallelTestState.inBlock = false;

    [global.beforeEach, global.afterEach] = [oldBeforeEach, oldAfterEach];

    const suites =  parallelTestState.suites
      .tap((s) => {
        s.tests = s.tests.filter(test => TEST_FILTER.test(test.name, ...CURRENT_DESCRIBE_NAMES));
      })
      .filter(s => s.tests.length);

    let results: AsyncSuiteResult[];

    before(async () => {
      const promises = suites.map((suite) => {
        return suite.tests.map(async (test) => {
          if (suite.skipped || test.skipped) {
            return null;
          }

          const startTime = performance.now();

          return {
            error: await tryCatchErr(() => test.testFn(UUID.v4().toString())),
            ms: performance.now() - startTime,
          };
        });
      });

      results = await Promise.all(promises.map(p => Promise.all(p)));
    });

    suites.forEach((suite, suiteIdx) => {
      const wrapperFn = (suite.name)
        ? (fn: () => void) => describe(suite.name!, () => {
          before(function () {
            if (suite.skipped) {
              this.skip();
            }
          });
          fn();
        })
        : (fn: () => void) => fn();

      wrapperFn(() => {
        suite.tests.forEach((test, testIdx) => {
          global.it(test.name, function () {
            if (test.skipped) {
              this.skip();
            }

            const result = results[suiteIdx][testIdx]!;

            this.test!.title += ` (${~~result.ms!}ms)`;

            if (result.error) {
              throw result.error;
            }
          });
        });
      });
    });

    parallelTestState.suites = [mkDefaultSuite()];
  }

  return describe(name, opts, modifiedFn);
};
