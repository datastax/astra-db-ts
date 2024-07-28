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
import { TEST_FILTER_PASSES } from '@/tests/testlib/global';
import { TESTS_FILTER } from '@/tests/testlib/config';

type TestFn = Mocha.Func | Mocha.AsyncFunc;

interface TaggableTestFunction {
  (name: string, fn: Mocha.Func): Mocha.Test | null;
  (name: string, fn: Mocha.AsyncFunc): Mocha.Test | null;
}

export let it: TaggableTestFunction;

const parallelItErrorProxy = new Proxy({}, {
  get() { throw new Error('Can not use return type of `it` when in a parallel block') },
});

it = function (name: string, fn: TestFn) {
  function modifiedFn(this: Mocha.Context) {
    checkTestsEnabled(name) || this.skip();
    return fn.call(this, null!);
  }

  if (parallelTestState.inParallelBlock) {
    parallelTestState.tests.push({ name, fn: <any>modifiedFn });
    return parallelItErrorProxy as any;
  }

  if (!TEST_FILTER_PASSES.some(b => b) && !TESTS_FILTER.test(name)) {
    return null;
  }

  return global.it(name, modifiedFn);
}
