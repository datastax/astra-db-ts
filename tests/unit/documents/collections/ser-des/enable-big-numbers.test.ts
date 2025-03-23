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

import { describe, it } from '@/tests/testlib/index.js';
import assert from 'assert';
import { CollSerDes } from '@/src/documents/collections/ser-des/ser-des.js';
import { BigNumber } from 'bignumber.js';
import type { CollNumCoercion, SomeDoc } from '@/src/documents/index.js';
import { NumCoercionError } from '@/src/documents/index.js';
import fc from 'fast-check';
import { arbs } from '@/tests/testlib/arbitraries.js';
import type { PathSegment } from '@/src/lib/index.js';
import { buildGetNumCoercionForPathFn } from '@/src/documents/collections/ser-des/big-nums.js';

describe('unit.documents.collections.ser-des.enable-big-numbers', () => {
  it('should error if big numbers not enabled', () => {
    const serdes = new CollSerDes(CollSerDes.cfg.empty);

    fc.assert(
      fc.property(fc.bigInt(), (bigint) => {
        assert.throws(() => serdes.serialize({ bigint }), { message: 'BigInt serialization must be enabled through serdes.enableBigNumbers in CollectionSerDesConfig' });
      }),
    );

    fc.assert(
      fc.property(arbs.bigNum(), (bigint) => {
        assert.throws(() => serdes.serialize({ bigint }), { message: 'BigNumber serialization must be enabled through serdes.enableBigNumbers in CollectionSerDesConfig' });
      }),
    );
  });

  it('should error if no default * is specified for a CollNumCoercionCfg', () => {
    fc.assert(
      fc.property(arbs.record(fc.anything()), (spec) => {
        fc.pre(!('*' in spec));
        assert.throws(() => new CollSerDes({ ...CollSerDes.cfg.empty, enableBigNumbers: spec as any }), {
          message: 'The configuration must contain a "*" key',
        });
      }), {
        examples: [[{ a: { '*': 'bignumber' } }]],
      },
    );
  });

  it('should optimize { "*": "..." } into a const function', () => {
    const fn = buildGetNumCoercionForPathFn(CollSerDes.cfg.parse({ enableBigNumbers: { '*': 'bigint' } }));
    assert.strictEqual(fn?.length, 0);
    assert.strictEqual((fn as any)?.(), 'bigint');
  });

  it('can deserialize a number directly via function', () => {
    const serdes = new CollSerDes({ ...CollSerDes.cfg.empty, enableBigNumbers: () => 'bigint' });
    assert.strictEqual(serdes.deserialize(42, {}), 42n);
  });

  it('can deserialize a number directly via spec', () => {
    const serdes = new CollSerDes({ ...CollSerDes.cfg.empty, enableBigNumbers: { '*': 'bigint', '*.*': 'number' } });
    assert.strictEqual(serdes.deserialize(42, {}), 42n);
  });

  describe('coercions', () => {
    const mkObj = (path: PathSegment[], num: unknown) => {
      const obj: SomeDoc = typeof path[0] === 'number' ? [] : {};
      let tempObj = obj;

      for (let i = 0; i < path.length - 1; i++) {
        tempObj[path[i]] = typeof path[i + 1] === 'number' ? Array(path[i + 1] as number).fill(undefined) : {};
        tempObj = tempObj[path[i]];
      }

      tempObj[path[path.length - 1]] = num;
      return obj;
    };

    const mkDesAsserter = (type: CollNumCoercion, coerce: (n: BigNumber | number) => unknown) => ({
      _serdesFn: new CollSerDes({ ...CollSerDes.cfg.empty, enableBigNumbers: () => type }),
      _serdesCfg: new CollSerDes({ ...CollSerDes.cfg.empty, enableBigNumbers: { '*': type, '*.*': type } }), // second wildcard prevents cfg object from being optimized into a const function `() => type`
      ok(path: PathSegment[], n: BigNumber | number) {
        fc.pre(path.length > 0);
        const exp = mkObj(path, coerce(n));
        assert.deepStrictEqual(this._serdesFn.deserialize(mkObj(path, n), null!), exp);
        assert.deepStrictEqual(this._serdesCfg.deserialize(mkObj(path, n), null!), exp);
      },
      notOk(path: PathSegment[], n: BigNumber | number) {
        fc.pre(path.length > 0);
        assert.throws(() => this._serdesFn.deserialize(mkObj(path, n), null!), NumCoercionError);
        assert.throws(() => this._serdesCfg.deserialize(mkObj(path, n), null!), NumCoercionError);
      },
    });

    it('should handle to-number coercion properly', () => {
      const desAsserter = mkDesAsserter('number', Number);

      fc.assert(
        fc.property(fc.oneof(fc.double(), arbs.bigNum()), arbs.path(), (num, path) => {
          desAsserter.ok(path, num);
        }),
      );
    });

    it('should handle to-strict-number coercion properly', () => {
      const desAsserter = mkDesAsserter('strict_number', Number);

      fc.assert(
        fc.property(fc.double(), arbs.path(), (num, path) => {
          desAsserter.ok(path, num);
        }),
      );

      fc.assert(
        fc.property(arbs.bigNum(), arbs.path(), (bigNum, path) => {
          if (bigNum.isEqualTo(bigNum.toNumber())) {
            desAsserter.ok(path, bigNum);
          } else {
            desAsserter.notOk(path, bigNum);
          }
        }),
      );
    });

    it('should handle to-bigint coercion properly', () => {
      const desAsserter = mkDesAsserter('bigint', (n) => BigInt(n.toFixed()));

      fc.assert(
        fc.property(fc.oneof(fc.integer(), fc.bigInt().map((n) => BigNumber(n.toString()))), arbs.path(), (num, path) => {
          desAsserter.ok(path, num);
        }),
      );

      fc.assert(
        fc.property(fc.double(), arbs.path(), (num, path) => {
          fc.pre(!Number.isInteger(num));
          desAsserter.notOk(path, num);
        }),
      );

      fc.assert(
        fc.property(arbs.bigNum(), arbs.path(), (num, path) => {
          fc.pre(!num.isInteger());
          desAsserter.notOk(path, num);
        }),
      );
    });

    it('should handle to-bignumber coercion properly', () => {
      const desAsserter = mkDesAsserter('bignumber', (n) => BigNumber(n));

      fc.assert(
        fc.property(fc.oneof(fc.double(), arbs.bigNum()), arbs.path(), (num, path) => {
          desAsserter.ok(path, num);
        }),
      );
    });

    it('should handle to-string coercion properly', () => {
      const desAsserter = mkDesAsserter('string', (n) => n.toString());

      fc.assert(
        fc.property(fc.oneof(fc.double(), arbs.bigNum()), arbs.path(), (num, path) => {
          desAsserter.ok(path, num);
        }),
      );
    });

    it('should handle to-number_or_string coercion properly', () => {
      const desAsserterNum = mkDesAsserter('number_or_string', Number);
      const desAsserterStr = mkDesAsserter('number_or_string', (n) => n.toString());

      fc.assert(
        fc.property(fc.double(), arbs.path(), (num, path) => {
          desAsserterNum.ok(path, num);
        }),
      );

      fc.assert(
        fc.property(arbs.bigNum(), arbs.path(), (bigNum, path) => {
          if (bigNum.isEqualTo(bigNum.toNumber())) {
            desAsserterNum.ok(path, bigNum);
          } else {
            desAsserterStr.ok(path, bigNum);
          }
        }),
      );
    });

    it('should allow a custom coercion function', () => {
      fc.assert(
        fc.property(fc.oneof(fc.double(), arbs.bigNum()), fc.anything(), arbs.path(), (num, output, path) => {
          const coerceFn = (n: number | BigNumber) => {
            assert.deepStrictEqual(n, num);
            return output;
          };

          const coerceFnAndTestPath = (n: number | BigNumber, path2: readonly PathSegment[]) => {
            assert.deepStrictEqual(path, path2);
            return coerceFn(n);
          };

          mkDesAsserter(coerceFnAndTestPath, coerceFn).ok(path, num);
        }),
      );
    });
  });
});
