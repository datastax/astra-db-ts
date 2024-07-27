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
import { checkTestsEnabled, tryCatchErr } from '@/tests/testlib/utils';
import { describe, it, SuiteOptions, TESTS_FILTER } from '@/tests/testlib';

export const parallelTestState = {
  inParallelBlock: false,
  tests: [] as ParallelTestSpec[],
}

interface ParallelTestSpec {
  name: string,
  fn: ParallelTest,
}

type ParallelBlock = (this: Mocha.Suite, fixtures: ReturnType<typeof initTestObjects>) => void;
type ParallelTest = () => Promise<void>;

interface ParallelizedTestsBlock {
  (name: string, fn: ParallelBlock): void;
  (name: string, options: SuiteOptions, fn: ParallelBlock): void;
}

export let parallel: ParallelizedTestsBlock;

parallel = function (name: string, optsOrFn: SuiteOptions | ParallelBlock, maybeFn?: ParallelBlock) {
  name = `(parallel) ${name}`

  const fn = (!maybeFn)
    ? optsOrFn as ParallelBlock
    : maybeFn;

  const opts = (maybeFn)
    ? optsOrFn as SuiteOptions
    : {};

  function modifiedFn(this: Mocha.Suite, fixtures: ReturnType<typeof initTestObjects>) {
    if (parallelTestState.inParallelBlock) {
      throw new Error('Can\'t nest parallel blocks');
    }

    const [oldBeforeEach, oldAfterEach] = [beforeEach, afterEach];

    global.beforeEach = () => { throw new Error('Can\'t use `beforeEach` in a parallel block'); }
    global.afterEach = () => { throw new Error('Can\'t use `afterEach` in a parallel block'); }

    parallelTestState.inParallelBlock = true;
    fn.call(this, fixtures);
    parallelTestState.inParallelBlock = false;

    [global.beforeEach, global.afterEach] = [oldBeforeEach, oldAfterEach];

    let tests = parallelTestState.tests.filter(t => TESTS_FILTER.test(t.name));
    let results: ({ ms?: number, error?: Error } | { skipped: true })[];

    before(async () => {
      const promises = tests.map(async (test) => {
        if (!checkTestsEnabled(name)) {
          return { skipped: true };
        }

        const startTime = performance.now();

        return {
          error: await tryCatchErr(test.fn),
          ms: performance.now() - startTime,
        };
      });

      results = await Promise.all(promises);
    });

    tests.forEach((t, i) => {
      it(t.name, function () {
        const result = results[i];

        if ('skipped' in result) {
          this.skip();
        }

        this.test!.title = `${t.name} (${~~result.ms!}ms)`;

        if (result.error) {
          throw result.error;
        }
      });
    });

    parallelTestState.tests = [];
  }

  return describe(name, opts, modifiedFn);
}
