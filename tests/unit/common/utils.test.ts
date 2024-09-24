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

import { describe, it } from '@/tests/testlib';
import assert from 'assert';
import { isNullish, jsonTryParse, validateDataAPIEnv } from '@/src/lib/utils';
import { DataAPIEnvironments } from '@/src/lib/constants';

describe('unit.common.utils', () => {
  describe('isNullish', () => {
    it('works', () => {
      assert.strictEqual(isNullish(null), true);
      assert.strictEqual(isNullish(undefined), true);
      assert.strictEqual(isNullish(NaN), false);
      assert.strictEqual(isNullish(''), false);
      assert.strictEqual(isNullish(0), false);
      assert.strictEqual(isNullish({}), false);
      assert.strictEqual(isNullish([]), false);
      assert.strictEqual(isNullish('hi!'), false);
    });
  });

  describe('validateDataAPIEnv', () => {
    it('works', () => {
      for (const env of [null, undefined, ...DataAPIEnvironments]) {
        assert.doesNotThrow(() => validateDataAPIEnv(env));
      }
      for (const env of [0, '', 'hi!', {}, [], 'ASTRA']) {
        assert.throws(() => validateDataAPIEnv(env));
      }
    });
  });

  describe('jsonTryParse', () => {
    it('works', () => {
      assert.deepStrictEqual(jsonTryParse('{}', 'else'), {});
      assert.strictEqual(jsonTryParse('no', 'else'), 'else');
    });
  });
});
