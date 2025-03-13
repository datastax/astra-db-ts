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
import { buildAstraEndpoint, forJSEnv, isBigNumber, isNullish, jsonTryParse, toArray } from '@/src/lib/utils.js';
import JBI from 'json-bigint';
import { pathArraysEqual, pathMatches, withJbiNullProtoFix } from '@/src/lib/api/ser-des/utils.js';

describe('unit.lib.utils', () => {
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

  describe('jsonTryParse', () => {
    it('works', () => {
      assert.deepStrictEqual(jsonTryParse('{}', 'else'), {});
      assert.strictEqual(jsonTryParse('no', 'else'), 'else');
    });
  });

  describe('buildAstraEndpoint', () => {
    it('works', () => {
      assert.strictEqual(
        'https://id-region.apps.astra.datastax.com',
        buildAstraEndpoint('id', 'region'),
      );
      assert.strictEqual(
        'https://id-region.apps.astra.datastax.com',
        buildAstraEndpoint('id', 'region', 'prod'),
      );
      assert.strictEqual(
        'https://id-region.apps-dev.astra.datastax.com',
        buildAstraEndpoint('id', 'region', 'dev'),
      );
    });
  });

  describe('toArray', () => {
    it('works', () => {
      assert.deepStrictEqual(toArray(1), [1]);
      assert.deepStrictEqual(toArray([1]), [1]);
      assert.deepStrictEqual(toArray([[1]]), [[1]]);
    });
  });

  describe('withJbiNullProtoFix', () => {
    it('works', () => {
      const jbi = withJbiNullProtoFix(JBI);

      assert.deepStrictEqual(Object.getPrototypeOf(JBI.parse('{ "a": 3 }')), null);
      assert.deepStrictEqual(Object.getPrototypeOf(jbi.parse('{ "a": 3 }')), Object.create(null));
      assert.deepStrictEqual(Object.getPrototypeOf(JSON.parse('{ "a": 3 }')), Object.create(null));

      const values = [
        {},
        [],
        [{}],
        { a: 1, b: { c: 2, d: { e: 3 } } },
        [{ a: 1, b: { c: 2, d: { e: 3 } } }],
        "hello world",
        BigNumber('12345678901234567890'),
      ];

      for (const value of values) {
        const parsed = jbi.parse(jbi.stringify(value));
        assert.deepStrictEqual(Object.getPrototypeOf(parsed), Object.getPrototypeOf(value));
        assert.deepStrictEqual(parsed, value);
      }
    });
  });

  describe('stringArraysEqual', () => {
    it('works', () => {
      assert.ok(!pathArraysEqual([], ['']));
      assert.ok(!pathArraysEqual(['a'], ['b']));
      assert.ok(!pathArraysEqual(['a'], ['a', 'b']));
      assert.ok(!pathArraysEqual(['a', 'b'], ['b', 'a']));

      assert.ok(pathArraysEqual([], []));
      assert.ok(pathArraysEqual(['a'], ['a']));
      assert.ok(pathArraysEqual(['a', 'b'], ['a', 'b']));
    });
  });

  describe('pathMatches', () => {
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
      assert.ok(pathMatches(['a', '*', 'c'], ['a', 'b', 'c']));
      assert.ok(pathMatches(['*', '*', 'c'], ['a', 'b', 'c']));
      assert.ok(pathMatches(['*', '*', '*'], ['a', 'b', 'c']));
      assert.ok(pathMatches(['*', 'b', 'c'], ['a', 'b', 'c']));

      assert.ok(!pathMatches(['*'], ['a', 'b']));
      assert.ok(!pathMatches(['*', 'a'], ['a', 'b']));
      assert.ok(!pathMatches(['*', '*'], ['a']));
      assert.ok(!pathMatches(['a', '*'], ['a']));
    });
  });

  describe('forJSEnv', () => {
    it('works in server', { pretendEnv: 'server' }, () => {
      const fn = forJSEnv({ server: () => 1, browser: () => 2, unknown: () => 3 });
      assert.strictEqual(fn(), 1);
    });

    it('works in browser', { pretendEnv: 'browser' }, () => {
      const fn = forJSEnv({ server: () => 1, browser: () => 2, unknown: () => 3 });
      assert.strictEqual(fn(), 2);
    });

    it('works in unknown', { pretendEnv: 'unknown' }, () => {
      const fn = forJSEnv({ server: () => 1, browser: () => 2, unknown: () => 3 });
      assert.strictEqual(fn(), 3);
    });
  });

  describe('isBigNumber', () => {
    it('works', () => {
      const ok = [
        BigNumber(123),
        new BigNumber(123),
        { _isBigNumber: true, s: 0, e: 0, c: 0 },
        new (class BigNumber { _isBigNumber = true; s = 0; e = 0; c = 0; })(),
        new (class Car { _isBigNumber = true; s = null; e = undefined; c = false; })(),
      ];
      ok.forEach(t => assert.ok(isBigNumber(t)));

      const notOk = [
        null as any,
        {},
        new (class BigNumber { _isBigNumber = 1; })(),
        new (class BigNumber {})(),
        { _isBigNumber: true },
        new (class BigNumber { _isBigNumber = true; })(),
        new (class Car { _isBigNumber = true; })(),
      ];
      notOk.forEach(t => assert.ok(!isBigNumber(t)));
    });
  });
});
