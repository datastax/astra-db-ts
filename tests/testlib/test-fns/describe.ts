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
import { checkTestsEnabled, dropEphemeralColls, dropEphemeralTables } from '@/tests/testlib/utils.js';
import { parallelTestState } from '@/tests/testlib/test-fns/parallel.js';
import { backgroundTestState, CURRENT_DESCRIBE_NAMES, GLOBAL_FIXTURES } from '@/tests/testlib/index.js';

export type SuiteBlock = (fixtures: ReturnType<typeof initTestObjects>) => void;

export interface SuiteOptions {
  truncate?: `${'colls' | 'tables'}:${'before' | 'beforeEach'}`,
  drop?: `${'colls' | 'tables'}:${'after' | 'afterEach'}`,
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
      if (!checkTestsEnabled(name)) {
        this.skip();
      }
    });

    if (opts?.truncate?.includes(':')) {
      global[opts?.truncate.split(':')[1] as keyof typeof globalThis](async () => {
        if (opts?.truncate?.startsWith('colls')) {
          await Promise.all([
            GLOBAL_FIXTURES.collection.deleteMany({}),
            GLOBAL_FIXTURES.collection_.deleteMany({}),
          ]);
        }
        if (opts?.truncate?.startsWith('tables')) {
          await Promise.all([
            GLOBAL_FIXTURES.table.deleteMany({}),
            GLOBAL_FIXTURES.table_.deleteMany({}),
          ]);
        }
      });
    }

    if (opts?.drop?.includes(':')) {
      if (opts?.drop.startsWith('colls')) {
        global[opts?.drop.split(':')[1] as keyof typeof globalThis](dropEphemeralColls);
      }
      if (opts?.drop.startsWith('tables')) {
        global[opts?.drop.split(':')[1] as keyof typeof globalThis](dropEphemeralTables);
      }
    }

    CURRENT_DESCRIBE_NAMES.push(name);
    fn(fixtures);
    CURRENT_DESCRIBE_NAMES.pop();
  }

  return global.describe(name, modifiedFn);
};
