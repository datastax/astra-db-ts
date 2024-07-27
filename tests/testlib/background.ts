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
import { TESTS_FILTER } from '@/tests/testlib/config';

export const globalBackgroundTests: BackgroundTestState[] = [];

type BackgroundTestState =
  ({
    name: string,
    res: Promise<{
      error?: Error,
      ms: number,
    }>,
  }) | ({
    name: string,
    skipped: true,
  });

type BackgroundTest = (fixtures: ReturnType<typeof initTestObjects>) => Promise<void>;

interface BackgroundTestsBlock {
  (name: string, fn: BackgroundTest): void;
  (name: string, fn: BackgroundTest): void;
}

export let background: BackgroundTestsBlock;

background = function (name: string, test: BackgroundTest) {
  if (!TESTS_FILTER.test(name)) {
    return;
  }

  if (!checkTestsEnabled(name)) {
    globalBackgroundTests.push({
      name: name,
      skipped: true,
    });
    return;
  }

  async function modifiedFn() {
    const startTime = performance.now();

    return {
      error: await tryCatchErr(() => test(initTestObjects())),
      ms: performance.now() - startTime,
    };
  }

  globalBackgroundTests.push({
    name: name,
    res: modifiedFn(),
  });
}
