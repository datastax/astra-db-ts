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
import { DEFAULT_COLLECTION_NAME, OTHER_NAMESPACE } from '@/tests/testlib/config';
import { afterEach } from 'mocha';
import { checkTestsEnabled, dropEphemeralColls, updatingGlobalTestFilter } from '@/tests/testlib/utils';
import { parallelTestState } from '@/tests/testlib/test-fns/parallel';
import { backgroundTestState } from '@/tests/testlib';

export type SuiteBlock = (fixtures: ReturnType<typeof initTestObjects>) => void;

export interface SuiteOptions {
  truncateColls?: `${'default' | 'both'}:${'before' | 'beforeEach'}`,
  dropEphemeral?: 'after' | 'afterEach',
}

interface TaggableSuiteFunction {
  (name: string, fn: SuiteBlock): Mocha.Suite | null;
  (name: string, options: SuiteOptions, fn: SuiteBlock): Mocha.Suite | null;
}

export let describe: TaggableSuiteFunction;

describe = function (name: string, optsOrFn: SuiteOptions | SuiteBlock, maybeFn?: SuiteBlock) {
  const fn = (!maybeFn)
    ? optsOrFn as SuiteBlock
    : maybeFn;

  const opts = (maybeFn)
    ? optsOrFn as SuiteOptions
    : undefined;

  const fixtures = initTestObjects();
  const skipped = !checkTestsEnabled(name);

  for (const asyncTestState of [parallelTestState, backgroundTestState]) {
    if (asyncTestState.inBlock) {
      asyncTestState.describe(name, fn, opts, skipped, fixtures);
      return null;
    }
  }

  function modifiedFn(this: Mocha.Suite) {
    before(function () {
      checkTestsEnabled(name) || this.skip();
    });

    if (opts?.truncateColls?.includes(':')) {
      global[opts.truncateColls.split(':')[1] as keyof typeof globalThis](async () => {
        await fixtures.collection.deleteMany({});

        if (opts?.truncateColls?.startsWith('both')) {
          await fixtures.db.collection(DEFAULT_COLLECTION_NAME, { namespace: OTHER_NAMESPACE }).deleteMany({});
        }
      });
    }

    if (opts?.dropEphemeral === 'after') {
      after(dropEphemeralColls);
    }

    if (opts?.dropEphemeral === 'afterEach') {
      afterEach(dropEphemeralColls);
    }

    updatingGlobalTestFilter(name, () => {
      fn(fixtures);
    });
  }

  return global.describe(name, modifiedFn);
}
