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

import { checkTestsEnabled } from '@/tests/testlib/utils.js';
import { parallelTestState } from '@/tests/testlib/test-fns/parallel.js';
import { CURRENT_DESCRIBE_NAMES, RUNNING_INT_TESTS } from '@/tests/testlib/global.js';
import { DEFAULT_TEST_TIMEOUT } from '@/tests/testlib/config.js';
import { UUID } from '@/src/documents/index.js';
import { backgroundTestState, TEST_FILTER } from '@/tests/testlib/index.js';

export type TestFn = SyncTestFn | AsyncTestFn;

type SyncTestFn = (...keys: string[]) => void;
type AsyncTestFn = (...keys: string[]) => Promise<void>;

interface TestOptions {
  pretendEnv?: 'server' | 'browser' | 'unknown';
}

interface TaggableTestFunction {
  (name: string, fn: SyncTestFn): Mocha.Test | null;
  (name: string, options: TestOptions, fn: SyncTestFn): Mocha.Test | null;
  (name: string, fn: AsyncTestFn): Mocha.Test | null;
  (name: string, options: TestOptions, fn: AsyncTestFn): Mocha.Test | null;
}

export let it: TaggableTestFunction;

// const nonstandardItProxy = new Proxy({}, {
//   get() { throw new Error('Can not use return type of `it` when in a parallel/background block') },
// });

it = function (name: string, optsOrFn: TestOptions | TestFn, maybeFn?: TestFn) {
  const testFn = (!maybeFn)
    ? optsOrFn as TestFn
    : maybeFn;

  const opts = (maybeFn)
    ? optsOrFn as TestOptions
    : undefined;

  const skipped = !checkTestsEnabled(name);

  if (isIntegrationTest() && !skipped) {
    RUNNING_INT_TESTS.ref = true;
  }

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
    if (skipped) {
      this.skip();
    }
    this.timeout(DEFAULT_TEST_TIMEOUT);

    const keys = Array.from({ length: testFn.length }, () => UUID.v4().toString());
    return pretendingEnv(opts?.pretendEnv ?? 'server', testFn)(...keys);
  }

  return global.it(name, modifiedFn);
};

const IntegrationTestRegex = /(?:{[a-z]*}\s+)?integration\./;

function isIntegrationTest() {
  return IntegrationTestRegex.exec(CURRENT_DESCRIBE_NAMES[0]);
}

function pretendingEnv(env: 'server' | 'browser' | 'unknown', fn: TestFn): TestFn {
  if (env === 'server') {
    return fn;
  }

  return (...args: string[]) => {
    const anyGlobalThis = globalThis as any;
    const [window, buffer] = [anyGlobalThis.window, anyGlobalThis.Buffer];

    anyGlobalThis.window = env === 'browser' ? globalThis : undefined;
    anyGlobalThis.Buffer = env === 'unknown' ? undefined : buffer;

    let res = fn(...args);

    if (res instanceof Promise) {
      res = res.finally(() => {
        [anyGlobalThis.window, anyGlobalThis.Buffer] = [window, buffer];
      });
    } else {
      [anyGlobalThis.window, anyGlobalThis.Buffer] = [window, buffer];
    }

    return res;
  };
}
