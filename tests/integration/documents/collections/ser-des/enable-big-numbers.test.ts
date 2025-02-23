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

import { DEFAULT_COLLECTION_NAME, it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';
import { BigNumber } from 'bignumber.js';
import type {
  CollectionCodec,
  CollectionDesCtx,
  CollNumRepCfg,
  CollectionSerCtx,
  GetCollNumRepFn} from '@/src/documents/index.js';
import {
  $DeserializeForCollection,
  $SerializeForCollection,
  CollectionCodecs,
  uuid,
} from '@/src/documents/index.js';

parallel('integration.documents.collections.ser-des.enable-big-numbers', ({ db }) => {
  const TestObjAct1 = (key: string) => ({
    _id: key,
    root0: 0,
    root1: BigNumber('12.12312321312312312312312321'), // why long des when GetCollNumRepFn
    stats: {
      stats0: -123,
      stats1: BigNumber('12321321321312312321312312321'),
      cars: [
        { a: BigNumber('-123.123') },
        { a: BigNumber('-123.123') },
        { a: -123.123 },
      ],
      mars: {
        stars: [{ bars: BigNumber(0) }, { czars: 1 }],
      },
    },
    bats: {
      mars: {
        stars: [{ bars: 2 }, { czars: 9007199254740991n }],
      },
    },
  });

  const TestObjExp1 = (key: string) => ({
    _id: key,
    root0: 0,
    root1: '12.12312321312312312312312321',
    stats: {
      stats0: -123n,
      stats1: 12321321321312312321312312321n,
      cars: [
        { a: -123.123 },
        { a: BigNumber('-123.123') },
        { a: BigNumber('-123.123') },
      ],
      mars: {
        stars: [{ bars: 0 }, { czars: 1n }],
      },
    },
    bats: {
      mars: {
        stars: [{ bars: 2 }, { czars: '9007199254740991' }],
      },
    },
  });

  const TestObjExp1d = (key: string) => ({
    _id: key,
    root0: BigNumber(0),
    root1: BigNumber('12.12312321312312312312312321'),
    stats: {
      stats0: BigNumber(-123),
      stats1: BigNumber(12321321321312312321312312321n.toString()),
      cars: [
        { a: BigNumber(-123.123) },
        { a: BigNumber('-123.123') },
        { a: BigNumber('-123.123') },
      ],
      mars: {
        stars: [{ bars: BigNumber(0) }, { czars: BigNumber(1) }],
      },
    },
    bats: {
      mars: {
        stars: [{ bars: BigNumber(2) }, { czars: BigNumber('9007199254740991') }],
      },
    },
  });

  const TestObjAct2 = (key: string) => ({
    _id: key,
    stats: 123,
  });

  const TestObjExp2 = (key: string) => ({
    _id: key,
    stats: '123',
  });

  const TestObjExp2d = (key: string) => ({
    _id: key,
    stats: BigNumber('123'),
  });

  const TestObjAct3 = (key: string) => ({
    _id: key,
  });

  const TestObjExp3 = (key: string) => ({
    _id: key,
  });

  const TestObjExp3d = (key: string) => ({
    _id: key,
  });

  class Newtype implements CollectionCodec<typeof Newtype> {
    constructor(public unwrap: unknown) {}

    [$SerializeForCollection](ctx: CollectionSerCtx) {
      return ctx.done(this.unwrap);
    }

    static [$DeserializeForCollection](value: string, ctx: CollectionDesCtx) {
      return ctx.done(new Newtype(value));
    }
  }

  const TestObjAct4 = (key: string) => ({
    _id: key,
    root0: new Newtype(BigNumber(3)),
    root1: new Newtype(9007199254740991n),
    stats: {
      value: new Newtype(3),
    },
  });

  const TestObjExp4 = (key: string) => ({
    _id: key,
    root0: 3,
    root1: '9007199254740991',
    stats: {
      value: 3n,
    },
  });

  const TestObjExp4d = (key: string) => ({
    _id: key,
    root0: BigNumber(3),
    root1: BigNumber('9007199254740991'),
    stats: {
      value: BigNumber(3),
    },
  });

  const mkAsserter = (opts: GetCollNumRepFn | CollNumRepCfg) => ({
    coll: db.collection(DEFAULT_COLLECTION_NAME, {
      serdes: {
        codecs: [CollectionCodecs.forName('camelCaseName2', Newtype)],
        enableBigNumbers: opts,
      },
    }),
    async ok(exp: (key: string) => object, act: (key: string) => object) {
      const key = uuid(4).toString();
      const { insertedId } = await this.coll.insertOne(act(key));
      assert.deepStrictEqual(await this.coll.findOne({ _id: insertedId }), exp(key));
    },
  });

  it('should work with a GetCollNumRepFn', async () => {
    const asserter = mkAsserter((path) => {
      if (path[0] !== 'stats') {
        return 'number_or_string';
      }

      if (path.length === 1) {
        return 'string';
      }

      if (path[1] === 'cars' && path[3] === 'a') {
        if (path[2] === 0) {
          return 'number';
        }
        return 'bignumber';
      }

      if (path[2] === 'stars' && path[4] === 'bars') {
        return 'number';
      }

      return 'bigint';
    });
    await asserter.ok(TestObjExp1, TestObjAct1);
    await asserter.ok(TestObjExp2, TestObjAct2);
    await asserter.ok(TestObjExp3, TestObjAct3);
    await asserter.ok(TestObjExp4, TestObjAct4);
  });

  it('should allow a universal default with a GetCollNumRepFn', async () => {
    const asserter = mkAsserter(() => 'bignumber');
    await asserter.ok(TestObjExp1d, TestObjAct1);
    await asserter.ok(TestObjExp2d, TestObjAct2);
    await asserter.ok(TestObjExp3d, TestObjAct3);
    await asserter.ok(TestObjExp4d, TestObjAct4);
  });

  it('should work with a CollNumRepCfg', async () => {
    const asserter = mkAsserter({
      '*':   'number_or_string',
      'stats': 'string',
      'stats.*': 'bigint',
      'stats.cars.0.a': 'number',
      'stats.cars.*.a': 'bignumber',
      'stats.*.stars.*.bars': 'number',
    });
    await asserter.ok(TestObjExp1, TestObjAct1);
    await asserter.ok(TestObjExp2, TestObjAct2);
    await asserter.ok(TestObjExp3, TestObjAct3);
    await asserter.ok(TestObjExp4, TestObjAct4);
  });

  it('should allow a universal default with a CollNumRepCfg', async () => {
    const asserter = mkAsserter({ '*': 'bignumber' });
    await asserter.ok(TestObjExp1d, TestObjAct1);
    // await asserter.ok(TestObjExp2d, TestObjAct2);
    // await asserter.ok(TestObjExp3d, TestObjAct3);
    // await asserter.ok(TestObjExp4d, TestObjAct4);
  });
});
