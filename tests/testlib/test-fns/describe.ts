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
import { DEFAULT_COLLECTION_NAME, OTHER_NAMESPACE, TESTS_FILTER } from '@/tests/testlib/config';
import { afterEach } from 'mocha';
import { checkTestsEnabled, dropEphemeralColls } from '@/tests/testlib/utils';
import { parallelTestState } from '@/tests/testlib/test-fns/parallel';
import { TEST_FILTER_PASSES } from '@/tests/testlib/global';

export type SuiteBlock = (this: Mocha.Suite, fixtures: ReturnType<typeof initTestObjects>) => void;

export interface SuiteOptions {
  truncateColls?: 'default' | 'both',
  dropEphemeral?: 'after' | 'afterEach',
}

interface TaggableSuiteFunction {
  (name: string, fn: SuiteBlock): Mocha.Suite;
  (name: string, options: SuiteOptions, fn: SuiteBlock): Mocha.Suite;
}

export let describe: TaggableSuiteFunction;

describe = function (name: string, optsOrFn: SuiteOptions | SuiteBlock, maybeFn?: SuiteBlock) {
  if (parallelTestState.inParallelBlock) {
    throw new Error('Can\'t use `describe` in parallel blocks');
  }

  const fn = (!maybeFn)
    ? optsOrFn as SuiteBlock
    : maybeFn;

  const opts = (maybeFn)
    ? optsOrFn as SuiteOptions
    : {};

  const fixtures = initTestObjects();

  function modifiedFn(this: Mocha.Suite) {
    before(function () {
      checkTestsEnabled(name) || this.skip();
    });

    if (opts.truncateColls) {
      beforeEach(async () => {
        await fixtures.collection.deleteMany({});

        if (opts.truncateColls === 'both') {
          await fixtures.db.collection(DEFAULT_COLLECTION_NAME, { namespace: OTHER_NAMESPACE }).deleteMany({});
        }
      });
    }

    if (opts.dropEphemeral === 'after') {
      after(dropEphemeralColls);
    }

    if (opts.dropEphemeral === 'afterEach') {
      afterEach(dropEphemeralColls);
    }

    TEST_FILTER_PASSES.push(TESTS_FILTER.test(name));

    fn.call(this, fixtures);

    TEST_FILTER_PASSES.pop();
  }

  return global.describe(name, modifiedFn);
}
