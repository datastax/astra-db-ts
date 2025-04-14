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
// noinspection DuplicatedCode,CommaExpressionJS

import { describe, it } from '@/tests/testlib/index.js';
import { CollectionCodecs, uuid } from '@/src/index.js';
import { CollSerDes } from '@/src/documents/collections/ser-des/ser-des.js';
import type { CollNominalCodecOpts } from '@/src/documents/collections/ser-des/codecs.js';
import assert from 'assert';
import { BigNumber } from 'bignumber.js';

describe('unit.documents.collections.ser-des.ser-des.map-after', () => {
  const repeat = <T>(mk: (n: number) => T) => Array.from({ length: 3 }, (_, i) => mk(i));

  describe('when serializing', () => {
    it('should execute in the proper order', () => {
      const res: unknown[] = [];

      const serFn = (tag: string): CollNominalCodecOpts => ({
        serialize: (_, ctx) => (ctx.mapAfter((v) => (res.push([tag, v]), v)), ctx.nevermind()),
      });

      const serdes = new CollSerDes({
        ...CollSerDes.cfg.empty,
        enableBigNumbers: { '*': 'bigint' },
        codecs: [
          repeat(() => CollectionCodecs.forName('root1',                  serFn('root1'))),
          repeat(() => CollectionCodecs.forName('nested1_obj',            serFn('obj'))),
          repeat(() => CollectionCodecs.forName('nested1_arr',            serFn('arr'))),
          repeat(() => CollectionCodecs.forName('0',                      serFn('0'))),
          repeat(() => CollectionCodecs.forName('a',                      serFn('a'))),
          repeat(() => CollectionCodecs.forName('root2',                  serFn('root2'))),
          repeat(() => CollectionCodecs.forName('$uuid',                  serFn('$uuid'))), // should never run

          repeat(() => CollectionCodecs.forPath(['root1', 'nested1_obj'], serFn('[root1.obj]'))),
          repeat(() => CollectionCodecs.forPath([],                       serFn('[]'))),

          [CollectionCodecs.custom({
            serializeClass: Map,
            serialize: (map, ctx) => ctx.recurse(Object.fromEntries(map)),
          })],
        ].sort(() => .5 - Math.random()).flat(),
      });

      const serialized = {
        root1: {
          nested1_arr: [1n],
          nested1_obj: { id: { $uuid: '00000000-0000-0000-0000-000000000000' } },
          nested1_map: { a: 'car', b: 'bus' },
        },
        root2: {
          nested2_date: { $date: 0 },
        },
      };

      assert.deepStrictEqual(serdes.serialize({
        root1: {
          nested1_arr: [1n],
          nested1_obj: { id: uuid('00000000-0000-0000-0000-000000000000') },
          nested1_map: new Map([['a', 'car'], ['b', 'bus']]),
        },
        root2: {
          nested2_date: new Date(0),
        },
      }), [serialized, true]);

      assert.deepStrictEqual(res, [
        repeat(() => ['0', serialized.root1.nested1_arr[0]]),
        repeat(() => ['arr', serialized.root1.nested1_arr]),
        repeat(() => ['obj', serialized.root1.nested1_obj]),
        repeat(() => ['[root1.obj]', serialized.root1.nested1_obj]),
        repeat(() => ['a', serialized.root1.nested1_map.a]),
        repeat(() => ['root1', serialized.root1]),
        repeat(() => ['root2', serialized.root2]),
        repeat(() => ['[]', serialized]),
      ].flat());
    });
  });

  describe('when deserializing', () => {
    it('should execute in the proper order', () => {
      const res: unknown[] = [];

      const serFn = (tag: string): CollNominalCodecOpts => ({
        deserialize: (_, ctx) => (ctx.mapAfter((v) => (res.push([tag, v]), v)), ctx.nevermind()),
      });

      const serdes = new CollSerDes({
        ...CollSerDes.cfg.empty,
        enableBigNumbers: { '*': 'bigint' },
        codecs: [
          repeat(() => CollectionCodecs.forName('root1',                  serFn('root1'))),
          repeat(() => CollectionCodecs.forName('nested1_obj',            serFn('obj'))),
          repeat(() => CollectionCodecs.forName('nested1_arr',            serFn('arr'))),
          repeat(() => CollectionCodecs.forName('0',                      serFn('0'))),
          repeat(() => CollectionCodecs.forName('a',                      serFn('a'))),
          repeat(() => CollectionCodecs.forName('root2',                  serFn('root2'))),
          repeat(() => CollectionCodecs.forName('$uuid',                  serFn('$uuid'))), // should never run

          repeat(() => CollectionCodecs.forPath(['root1', 'nested1_obj'], serFn('[root1.obj]'))),
          repeat(() => CollectionCodecs.forPath([],                       serFn('[]'))),

          [CollectionCodecs.forName('nested1_map', {
            deserialize: (_, ctx) => (ctx.mapAfter((obj) => new Map(Object.entries(obj))), ctx.nevermind()),
          })],
        ].sort(() => .5 - Math.random()).flat(),
      });

      const deserialized = {
        root1: {
          nested1_arr: [1n],
          nested1_obj: { id: uuid('00000000-0000-0000-0000-000000000000') },
          nested1_map: new Map([['a', 'car'], ['b', 'bus']]),
        },
        root2: {
          nested2_date: new Date(0),
        },
      };

      assert.deepStrictEqual(serdes.deserialize({
        root1: {
          nested1_arr: [BigNumber(1)],
          nested1_obj: { id: { $uuid: '00000000-0000-0000-0000-000000000000' } },
          nested1_map: { a: 'car', b: 'bus' },
        },
        root2: {
          nested2_date: { $date: 0 },
        },
      }, {}), deserialized);

      assert.deepStrictEqual(res, [
        repeat(() => ['0', deserialized.root1.nested1_arr[0]]),
        repeat(() => ['arr', deserialized.root1.nested1_arr]),
        repeat(() => ['obj', deserialized.root1.nested1_obj]),
        repeat(() => ['[root1.obj]', deserialized.root1.nested1_obj]),
        repeat(() => ['a', deserialized.root1.nested1_map.get('a')]),
        repeat(() => ['root1', deserialized.root1]),
        repeat(() => ['root2', deserialized.root2]),
        repeat(() => ['[]', deserialized]),
      ].flat());
    });
  });
});
