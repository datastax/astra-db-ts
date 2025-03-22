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
import {
  buildAstraEndpoint,
  findLast,
  forJSEnv,
  isBigNumber,
  isNullish,
  jsonTryParse,
  jsonTryStringify,
  numDigits, QueryState,
  toArray,
} from '@/src/lib/utils.js';
import fc from 'fast-check';
import { negate } from '@/tests/testlib/utils.js';

describe('unit.lib.utils', () => {
  describe('isNullish', () => {
    it('works', () => {
      fc.assert(fc.property(fc.anything(), (x) => isNullish(x) === (x === null || x === undefined)));
    });
  });

  describe('jsonTryParse', () => {
    it('works', (key) => {
      fc.assert(fc.property(fc.json(), (x) => {
        assert.deepStrictEqual(jsonTryParse(x, key), JSON.parse(x));
      }));

      fc.assert(fc.property(fc.anything(), (otherwise) => {
        assert.strictEqual(jsonTryParse('{"a":3', otherwise), otherwise);
      }));
    });
  });

  describe('jsonTryStringify', () => {
    it('works', (key) => {
      fc.assert(fc.property(fc.jsonValue(), (x) => {
        assert.deepStrictEqual(jsonTryStringify(x, key), JSON.stringify(x));
      }));

      fc.assert(fc.property(fc.string(), (otherwise) => {
        assert.strictEqual(jsonTryStringify(1n, otherwise), otherwise);
      }));
    });
  });

  describe('buildAstraEndpoint', () => {
    it('works', () => {
      assert.strictEqual('https://id-region.apps.astra.datastax.com', buildAstraEndpoint('id', 'region'));
      assert.strictEqual('https://id-region.apps.astra.datastax.com', buildAstraEndpoint('id', 'region', 'prod'));
      assert.strictEqual('https://id-region.apps-dev.astra.datastax.com', buildAstraEndpoint('id', 'region', 'dev'));
      assert.strictEqual('https://id-region.apps-test.astra.datastax.com', buildAstraEndpoint('id', 'region', 'test'));
    });
  });

  describe('toArray', () => {
    it('works', () => {
      assert.deepStrictEqual(toArray(1), [1]);
      assert.deepStrictEqual(toArray([1]), [1]);
      assert.deepStrictEqual(toArray([[1]]), [[1]]);
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

  describe('numDigits', () => {
    it('returns the correct number of digits', () => {
      fc.assert(
        fc.property(fc.integer(), (n) => {
          const expected = n.toString().replace("-", "").length;
          assert.strictEqual(numDigits(n), expected);
        }),
      );
    });

    it('is the same for positive and negative numbers', () => {
      fc.assert(
        fc.property(fc.integer(), (n) => {
          assert.strictEqual(numDigits(n), numDigits(-n));
        }),
      );
    });
  });

  describe('findLast', () => {
    it('should find the last of a value in the array', () => {
      assert.strictEqual(findLast((x) => x === 3)([1, 2, 3, 4, 3, 5]), 3);

      fc.assert(
        fc.property(fc.array(fc.anything(), { minLength: 2 }), fc.anything(), (arr, target) => {
          const pred = (x: unknown) => x === target;

          fc.pre(arr.every(negate(pred)));
          fc.pre(!(typeof target === 'number' && isNaN(target)));

          const randIndex = ~~(Math.random() * arr.length - 1);
          arr[randIndex] = target;
          arr[randIndex + 1] = target;

          assert.strictEqual(findLast(pred)(arr), target);
        }),
      );
    });

    it('returns undefined or the fallback if no element matches', () => {
      assert.strictEqual(findLast((x) => x === 3)([1, 2, 4, 5]), undefined);
      assert.strictEqual(findLast((x) => x === 3, 3)([1, 2, 4, 5]), 3);

      fc.assert(
        fc.property(fc.array(fc.anything()), fc.anything(), fc.anything(), (arr, target, fallback) => {
          const pred = (x: unknown) => x === target;
          fc.pre(arr.every(negate(pred)));

          assert.strictEqual(findLast(pred)(arr), undefined);
          assert.strictEqual(findLast(pred, fallback)(arr), fallback);
        }),
      );
    });

    it('is the same as find on the reversed array', () => {
      fc.assert(
        fc.property(fc.array(fc.integer()), (arr) => {
          const pred = (x: number) => x % 2 === 0;
          const expected = arr.slice().reverse().find(pred);
          const result = findLast(pred)(arr);
          assert.strictEqual(result, expected);
        }),
      );
    });
  });

  describe('QueryState', () => {
    it('should be initialized as unattempted', () => {
      const qs = new QueryState();
      assert.strictEqual(qs.state, QueryState.Unattempted);
      assert.strictEqual(qs.unwrap(), null);
    });

    it('should set the right state when advanced', () => {
      const qs = new QueryState();

      fc.assert(
        fc.property(fc.option(fc.anything()), (value) => {
          qs.swap(value);

          if (isNullish(value)) {
            assert.strictEqual(qs.state, QueryState.NotFound);
            assert.strictEqual(qs.unwrap(), null);
          } else {
            assert.strictEqual(qs.state, QueryState.Found);
            assert.strictEqual(qs.unwrap(), value);
          }
        }),
      );
    });
  });
});
