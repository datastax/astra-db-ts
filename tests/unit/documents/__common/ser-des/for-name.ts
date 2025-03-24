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

import type { CollectionCodecs, TableCodecs } from '@/src/documents/index.js';
import type { TableSerDes } from '@/src/documents/tables/ser-des/ser-des.js';
import type { CollSerDes } from '@/src/documents/collections/ser-des/ser-des.js';
import fc from 'fast-check';
import type { StrictCreateTableColumnDefinition } from '@/src/db/index.js';
import { unitTestCodecBuilderCommon } from '@/tests/unit/documents/__common/ser-des/codec-builders-common.js';
import { it } from '@/tests/testlib/index.js';
import type { BaseSerDesCtx, RawCodec } from '@/src/lib/index.js';
import assert from 'assert';
import { traverseObject } from '@/tests/testlib/utils.js';
import { arbs } from '@/tests/testlib/arbitraries.js';

export interface ForNameTestsConfig {
  datatypesArb: () => fc.Arbitrary<[unknown, unknown, StrictCreateTableColumnDefinition?]>,
  CodecsClass: typeof CollectionCodecs | typeof TableCodecs,
  SerDesClass: typeof CollSerDes | typeof TableSerDes,
  $SerSym: symbol,
  $DesSym: symbol,
}

export const unitTestForName = ({ $DesSym, CodecsClass, SerDesClass }: ForNameTestsConfig) => {
  unitTestCodecBuilderCommon({ $DesSym, CodecsClass, mkRawCodecs: (cls) => CodecsClass.forName('', cls) });

  const mkSerDesWithCodecs = (codecs: (readonly RawCodec[])[]) => {
    return new SerDesClass({ ...SerDesClass.cfg.empty, codecs } as any);
  };

  it('should ser/des keys with matching names', () => {
    const arb = fc.jsonValue({ depthSize: 'medium' })
      .filter((val) => !!val && typeof val === 'object')
      .filter((val) => Object.keys(val).length > 0)
      .chain((val) => {
        return fc.tuple(fc.constant(val), fc.constantFrom(...Object.keys(val)));
      });

    fc.assert(
      fc.property(arb, ([obj, targetKey]) => {
        const codec = CodecsClass.forName(targetKey, {
          serialize: (v: any, ctx: BaseSerDesCtx) => ctx.done(JSON.stringify(v)),
          deserialize: (v: any, ctx: BaseSerDesCtx) => ctx.done(JSON.stringify(v)),
        });

        const serdes = mkSerDesWithCodecs([codec]);

        const expectedObj = structuredClone(obj);
        traverseObject(expectedObj, (obj, key) => {
          fc.pre(key !== '');

          if (String(key) === targetKey) {
            obj[key] = JSON.stringify(obj[key]);
          }
        });

        assert.deepStrictEqual(serdes.serialize(obj), [expectedObj, false]);
        assert.deepStrictEqual(serdes.deserialize(obj, { status: { projectionSchema: {} } }), expectedObj);
      }),
    );
  });

  it('should not do anything when returning ctx.nevermind()', () => {
    const arb = arbs.jsonObj()
      .filter((val) => Object.keys(val).length > 0)
      .chain((val) => {
        return fc.tuple(fc.constant(val), fc.constantFrom(...Object.keys(val)));
      });

    fc.assert(
      fc.property(arb, fc.integer({ min: 1, max: 100 }), ([obj, targetKey], numCodecs) => {
        const matchingValuesSet = new Set<any>();
        let expectMatched = 0, matchedSer = 0, matchedDes = 0;

        const codec = CodecsClass.forName(targetKey, {
          serialize(v: any, ctx: BaseSerDesCtx) {
            assert.ok(matchingValuesSet.has(v));
            matchedSer++;
            return ctx.nevermind();
          },
          deserialize(v: any, ctx: BaseSerDesCtx) {
            assert.ok(matchingValuesSet.has(v));
            matchedDes++;
            return ctx.nevermind();
          },
        });

        const serdes = mkSerDesWithCodecs(Array(numCodecs).fill(codec));

        traverseObject(obj, (obj, key) => {
          fc.pre(key !== '');

          if (String(key) === targetKey) {
            matchingValuesSet.add(obj[key]);
            expectMatched++;
          }
        });

        assert.deepStrictEqual(serdes.serialize(obj), [obj, false]);
        assert.deepStrictEqual(serdes.deserialize(obj, { status: { projectionSchema: {} } }), obj);
        assert.ok(matchingValuesSet.size > 0);
        assert.ok(expectMatched >= matchingValuesSet.size);
        assert.strictEqual(matchedSer, expectMatched * numCodecs);
        assert.strictEqual(matchedDes, expectMatched * numCodecs);
      }),
    );
  });

  it('should match the root obj when the key is an empty string', () => {
    fc.assert(
      fc.property(arbs.jsonObj(), (obj) => {
        const codec = CodecsClass.forName('', {
          serialize: (v: any, ctx: BaseSerDesCtx) => ctx.done(JSON.stringify(v)),
          deserialize: (v: any, ctx: BaseSerDesCtx) => ctx.done(JSON.stringify(v)),
        });

        const serdes = mkSerDesWithCodecs([codec]);
        const expected = JSON.stringify(obj);

        assert.deepStrictEqual(serdes.serialize(obj), [expected, false]);
        assert.deepStrictEqual(serdes.deserialize(obj, { status: { projectionSchema: {} } }), expected);
      }),
    );
  });
};
