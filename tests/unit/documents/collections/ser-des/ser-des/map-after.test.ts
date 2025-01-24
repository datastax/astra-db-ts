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

import { describe, it } from '@/tests/testlib';
import { Camel2SnakeCase, CollCodecs, uuid } from '@/src/index';
import { CollectionSerDes } from '@/src/documents/collections/ser-des/ser-des';
import { CollNominalCodecOpts } from '@/src/documents/collections/ser-des/codecs';
import assert from 'assert';

describe('unit.documents.collections.ser-des.ser-des.map-after', () => {
  const repeat = <T>(mk: (n: number) => T) => Array.from({ length: 3 }, (_, i) => mk(i));

  describe('when serializing', () => {
    it('should execute in the proper order', () => {
      const res: unknown[] = [];

      const serFn = (tag: string): CollNominalCodecOpts => ({
        serialize: (_, __, ctx) => (ctx.mapAfter((v) => (res.push([tag, v]), v)), ctx.nevermind()),
      });

      const serdes = new CollectionSerDes({
        enableBigNumbers: { '*': 'bigint' },
        codecs: [
          repeat(() => CollCodecs.forName('root1',                  serFn('root1'))),
          repeat(() => CollCodecs.forName('nested1_obj',            serFn('obj'))),
          repeat(() => CollCodecs.forName('nested1_arr',            serFn('arr'))),
          repeat(() => CollCodecs.forName('0',                      serFn('0'))),
          repeat(() => CollCodecs.forName('a',                      serFn('a'))),
          repeat(() => CollCodecs.forName('root2',                  serFn('root2'))),
          repeat(() => CollCodecs.forName('$uuid',                  serFn('$uuid'))), // should never run

          repeat(() => CollCodecs.forPath(['root1', 'nested1_obj'], serFn('[root1.obj]'))),
          repeat(() => CollCodecs.forPath([],                       serFn('[]'))),

          CollCodecs.custom({
            serializeClass: Map,
            serialize: (_, map, ctx) => ctx.continue(Object.fromEntries(map)),
          }),
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

    it('should not capture key transformations', () => {
      let val!: unknown;

      const serdes = new CollectionSerDes({
        keyTransformer: new Camel2SnakeCase(),
        codecs: [
          CollCodecs.forPath([], { serialize: (_, __, ctx) => (ctx.mapAfter((v) => val = v), ctx.nevermind()) }),
        ],
      });

      assert.deepStrictEqual(serdes.serialize({ camelCase: new Date(0) }), [{ camel_case: { $date: 0 } }, false]);
      assert.deepStrictEqual(val, { camelCase: { $date: 0 } });
    });
  });

  describe('when deserializing', () => {
    it('should execute in the proper order', () => {
      const res: unknown[] = [];

      const serFn = (tag: string): CollNominalCodecOpts => ({
        deserialize: (_, __, ctx) => (ctx.mapAfter((v) => (res.push([tag, v]), v)), ctx.nevermind()),
      });

      const serdes = new CollectionSerDes({
        enableBigNumbers: { '*': 'bigint' },
        codecs: [
          repeat(() => CollCodecs.forName('root1',                  serFn('root1'))),
          repeat(() => CollCodecs.forName('nested1_obj',            serFn('obj'))),
          repeat(() => CollCodecs.forName('nested1_arr',            serFn('arr'))),
          repeat(() => CollCodecs.forName('0',                      serFn('0'))),
          repeat(() => CollCodecs.forName('a',                      serFn('a'))),
          repeat(() => CollCodecs.forName('root2',                  serFn('root2'))),
          repeat(() => CollCodecs.forName('$uuid',                  serFn('$uuid'))), // should never run

          repeat(() => CollCodecs.forPath(['root1', 'nested1_obj'], serFn('[root1.obj]'))),
          repeat(() => CollCodecs.forPath([],                       serFn('[]'))),

          CollCodecs.forName('nested1_map', {
            deserialize: (_, __, ctx) => (ctx.mapAfter((obj) => new Map(Object.entries(obj))), ctx.nevermind()),
          }),
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
          nested1_arr: [1n],
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
