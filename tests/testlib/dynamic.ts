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

import { describe, initTestObjects, it, SuiteBlock } from '@/tests/testlib';

interface DynamicTestConfig {
  (name: string, fn: SuiteBlock): void;
  (name: string, fn: SuiteBlock): void;
}

export let dynamic: DynamicTestConfig;

dynamic = function (name: string, fn: SuiteBlock) {
  describe(`(dynamic) ${name}`, function () {
    before(() => fn.call(this, initTestObjects()));
    it('Dummy test that always runs', () => {});
  });
}
