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

import assert from 'assert';
import { describe, it } from '@/tests/testlib/index.js';
import { BigNumber } from 'bignumber.js';
import { pathArraysEqual, pathMatches, withJbiNullProtoFix } from '@/src/lib/api/ser-des/utils.js';
import JBI from 'json-bigint';
import fc from 'fast-check';
import { arbs } from '@/tests/testlib/arbitraries.js';

describe('unit.lib.api.serdes.utils', () => {
  describe('withJbiNullProtoFix', () => {
    it('successfully replaces all null prototypes', () => {
      const jbi = withJbiNullProtoFix(JBI);

      assert.deepStrictEqual(Object.getPrototypeOf(JBI.parse('{ "a": 3 }')), null);
      assert.deepStrictEqual(Object.getPrototypeOf(jbi.parse('{ "a": 3 }')), Object.create(null));

      const values = [
        {},
        [],
        [{}],
        { a: 1, b: { c: BigNumber('321312312312312212121221'), d: { e: 3 } } },
        [{ a: 1, b: { c: 2, d: { e: 3 } } }],
        "hello world",
        BigNumber('12345678901234567890'),
        { a: [BigNumber('12345678901234567890213213123')] },
      ];

      for (const value of values) {
        const parsed = jbi.parse(jbi.stringify(value));
        assert.deepStrictEqual(parsed, value);
      }

      fc.assert(
        fc.property(fc.json(), (value) => {
          assert.deepStrictEqual(jbi.parse(jbi.stringify(value)), value);
        }),
      );
    });
  });

  describe('pathArraysEqual', () => {
    it('should return true for any same arrays', () => {
      fc.assert(
        fc.property(fc.clone(arbs.path(), 2), ([arr1, arr2]) => {
          assert.ok(pathArraysEqual(arr1, arr2));
        }),
      );
    });

    it('should return false for any different arrays', () => {
      fc.assert(
        fc.property(arbs.path(), arbs.path(), (arr1, arr2) => {
          fc.pre(JSON.stringify(arr1) !== JSON.stringify(arr2));
          assert.ok(!pathArraysEqual(arr1, arr2));
        }),
      );
    });

    it('is symmetric', () => {
      fc.assert(
        fc.property(arbs.path(), arbs.path(), (arr1, arr2) => {
          assert.strictEqual(pathArraysEqual(arr1, arr2), pathArraysEqual(arr2, arr1));
        }),
      );
    });
  });

  describe('pathMatches', () => {
    const pathArb = fc.array(fc.oneof(fc.string(), fc.integer()));

    it('behaves like pathArraysEqual if exp has no wildcard', () => {
      fc.assert(
        fc.property(pathArb, pathArb, (pattern, arr) => {
          fc.pre(!pattern.includes('*'));
          assert.strictEqual(pathMatches(pattern, arr), pathArraysEqual(arr, pattern));
        }),
      );
    });

    it("should allow wildcards to match any segment", () => {
      fc.assert(
        fc.property(pathArb, pathArb, (pattern, arr) => {
          fc.pre(pattern.length === arr.length);

          const arraysEqual = JSON.stringify(pattern) === JSON.stringify(arr);
          assert.strictEqual(pathMatches(pattern, arr), arraysEqual);

          const adjustedPattern = pattern.map((p, i) => (p === arr[i] ? p : '*'));
          assert.ok(pathMatches(adjustedPattern, arr));
        }),
      );
    });

    it('works', () => {
      assert.ok(!pathMatches([], ['']));
      assert.ok(!pathMatches(['a'], ['b']));
      assert.ok(!pathMatches(['a'], ['a', 'b']));
      assert.ok(!pathMatches(['a', 'b'], ['b', 'a']));

      assert.ok(pathMatches([], []));
      assert.ok(pathMatches(['a'], ['a']));
      assert.ok(pathMatches(['a', 'b'], ['a', 'b']));

      assert.ok(pathMatches(['*'], ['a']));
      assert.ok(pathMatches(['a', '*'], ['a', 'b']));
      assert.ok(pathMatches(['a', '*',   0], ['a', 'b',   0]));
      assert.ok(pathMatches(['*', '*',   0], ['a', 'b',   0]));
      assert.ok(pathMatches(['*', '*', '*'], ['a', 'b',   0]));
      assert.ok(pathMatches(['*', 'b',   0], ['a', 'b',   0]));

      assert.ok(!pathMatches(['*'], ['a', 'b']));
      assert.ok(!pathMatches(['*', 'a'], ['a', 'b']));
      assert.ok(!pathMatches(['*', '*'], ['a']));
      assert.ok(!pathMatches(['a', '*'], ['a']));
      assert.ok(!pathMatches(['a', '0'], ['a', 0]));
    });
  });
});
