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

import { globalBackgroundTests } from '@/tests/testlib';

describe('(background)', () => {
  globalBackgroundTests.forEach((test) => {
    it(test.name, async function () {
      if ('skipped' in test) {
        this.skip();
      } else {
        const startTime = performance.now();
        const result = await test.res;
        console.log('background test waited', performance.now() - startTime);

        this.test!.title = `${test.name} (${~~result.ms}ms)`;

        if (result.error) {
          throw result.error;
        }
      }
    });
  });
});
