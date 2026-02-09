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

import { DemoAstraEndpoint, describe, it } from '@/tests/testlib/index.js';
import assert from 'assert';
import { extractAstraEnvironment, idFromDbLike } from '@/src/administration/utils.js';
import type { Db } from '@/src/index.js';

describe('unit.administration.utils', () => {
  describe('extractAstraEnvironment', () => {
    it('works', () => {
      assert.strictEqual(extractAstraEnvironment(DemoAstraEndpoint), 'prod');
      assert.strictEqual(extractAstraEnvironment('|apps.astra-dev.datastax.com|'), 'dev');
      assert.strictEqual(extractAstraEnvironment('|apps.astra-test.datastax.com|'), 'test');
      assert.throws(() => extractAstraEnvironment('|apps.astra-car.datastax.com|'));
      assert.throws(() => extractAstraEnvironment('astra-dev'));
    });

    describe('idFromDbLike', () => {
      it('should extract ID from string', () => {
        const id = 'a6a1d8d6-31bc-4af8-be57-377566f345bf';
        assert.strictEqual(idFromDbLike(id), id);
      });

      it('should extract ID from Db instance', () => {
        const mockDb = { id: 'a6a1d8d6-31bc-4af8-be57-377566f345bf' } as Db;
        assert.strictEqual(idFromDbLike(mockDb), 'a6a1d8d6-31bc-4af8-be57-377566f345bf');
      });
    });
  });
});
