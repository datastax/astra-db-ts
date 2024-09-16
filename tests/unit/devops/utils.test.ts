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
// noinspection DuplicatedCode

import { DEMO_APPLICATION_URI, describe, it } from '@/tests/testlib';
import assert from 'assert';
import { extractAstraEnvironment } from '@/src/devops/utils';

describe('unit.devops.utils', () => {
  describe('extractAstraEnvironment', () => {
    it('works', () => {
      assert.strictEqual(extractAstraEnvironment(DEMO_APPLICATION_URI), 'prod');
      assert.strictEqual(extractAstraEnvironment('|apps.astra-dev.datastax.com|'), 'dev');
      assert.strictEqual(extractAstraEnvironment('|apps.astra-test.datastax.com|'), 'test');
      assert.throws(() => extractAstraEnvironment('castamere'));
    });
  });
});
