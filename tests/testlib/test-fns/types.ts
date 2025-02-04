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

import type { initTestObjects, SuiteBlock, SuiteOptions, TestFn } from '@/tests/testlib';

type DescribeImpl = (name: string, suite: SuiteBlock, opts: SuiteOptions | undefined, skipped: boolean, fixtures: ReturnType<typeof initTestObjects>) => void;

type ItImpl = (name: string, testFn: TestFn, skipped: boolean) => void;

export interface GlobalAsyncSuitesSpec {
  inBlock: boolean,
  suites: AsyncSuiteSpec[],
  describe: DescribeImpl,
  it: ItImpl,
}

export interface AsyncSuiteSpec {
  name?: string,
  skipped: boolean,
  tests: AsyncTestSpec[],
}

export interface AsyncTestSpec {
  name: string,
  skipped: boolean,
  testFn: TestFn,
}

export type AsyncSuiteResult = (AsyncTestResult | null)[];

export interface AsyncTestResult {
  error?: Error,
  ms: number,
}
