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
import { CollectionSerDes } from '@/src/documents/collections/ser-des/ser-des';
import BigNumber from 'bignumber.js';
import { CollNumRep, NumCoercionError } from '@/src/documents';

describe('unit.documents.collections.ser-des.enable-big-numbers', () => {
  describe('coercions', () => {
    const mkDesAsserter = (type: CollNumRep, coerce: (n: BigNumber | number) => unknown) => ({
      _serdesFn: new CollectionSerDes({ enableBigNumbers: () => type }),
      _serdesCfg: new CollectionSerDes({ enableBigNumbers: { '*': type } }),
      ok(n: BigNumber | number) {
        assert.deepStrictEqual(this._serdesFn.deserialize({ n }, null!), { n: coerce(n) });
        assert.deepStrictEqual(this._serdesCfg.deserialize({ n }, null!), { n: coerce(n) });
      },
      notOk(n: BigNumber | number) {
        assert.throws(() => this._serdesFn.deserialize({ n }, null!), NumCoercionError);
        assert.throws(() => this._serdesCfg.deserialize({ n }, null!), NumCoercionError);
      },
    });

    it('should handle to-number coercion properly', () => {
      const desAsserter = mkDesAsserter('number', Number);

      desAsserter.ok(0);
      desAsserter.ok(123);
      desAsserter.ok(-123.123);
      desAsserter.ok(BigNumber(123));
      desAsserter.ok(BigNumber(-123.123));

      desAsserter.notOk(BigNumber('120213123123123123213213'));
      desAsserter.notOk(BigNumber('12.213123123123123213213'));
    });

    it('should handle to-bigint coercion properly', () => {
      const desAsserter = mkDesAsserter('bigint', (n) => BigInt(n.toFixed()));

      desAsserter.ok(0);
      desAsserter.ok(123);
      desAsserter.ok(-123);
      desAsserter.ok(BigNumber('1200213123123123123213213'));
      desAsserter.ok(BigNumber('-120213123123123123213213'));

      desAsserter.notOk(BigNumber('12.213123123123123213213'));
      desAsserter.notOk(.1);
    });

    it('should handle to-bignumber coercion properly', () => {
      const desAsserter = mkDesAsserter('bignumber', (n) => BigNumber(n));

      desAsserter.ok(0);
      desAsserter.ok(123);
      desAsserter.ok(-123);
      desAsserter.ok(BigNumber('1200213123123123123213213'));
      desAsserter.ok(BigNumber('-120213123123123123213213'));
      desAsserter.ok(BigNumber('12.213123123123123213213'));
      desAsserter.ok(.1);
    });

    it('should handle to-string coercion properly', () => {
      const desAsserter = mkDesAsserter('string', (n) => n.toString());

      desAsserter.ok(0);
      desAsserter.ok(123);
      desAsserter.ok(-123);
      desAsserter.ok(BigNumber('1200213123123123123213213'));
      desAsserter.ok(BigNumber('-120213123123123123213213'));
      desAsserter.ok(BigNumber('12.213123123123123213213'));
      desAsserter.ok(.1);
    });

    it('should handle to-number_or_string coercion properly', () => {
      const desAsserterNum = mkDesAsserter('number_or_string', Number);
      const desAsserterStr = mkDesAsserter('number_or_string', (n) => n.toString());

      desAsserterNum.ok(0);
      desAsserterNum.ok(123);
      desAsserterNum.ok(-123);
      desAsserterStr.ok(BigNumber('1200213123123123123213213'));
      desAsserterStr.ok(BigNumber('-120213123123123123213213'));
      desAsserterStr.ok(BigNumber('12.213123123123123213213'));
      desAsserterNum.ok(.1);
    });
  });
});
