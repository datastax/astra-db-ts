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
import assert from 'assert';
import { CollectionSerDes } from '@/src/documents/collections/ser-des/ser-des';
import { CollCodecs } from '@/src/documents/collections';
import { uuid, UUID } from '@/src/documents';
import { ctxRecurse, ctxDone, ctxContinue } from '@/src/lib/api/ser-des/ctx';

describe('unit.documents.collections.ser-des.ser-des.codecs', () => {
  describe('forPath', () => {
    it('should match a variety of paths', () => {
      const serPaths = [] as unknown[];
      const desPaths = [] as unknown[];

      const visit = (arr: unknown[], v: unknown) => (value: unknown) => (arr.push(v ?? value), ctxContinue());
      const serdesFns = (v: unknown = null) => ({ serialize: visit(serPaths, v), deserialize: visit(desPaths, v) });

      const serdes = new CollectionSerDes({
        codecs: [
          CollCodecs.forPath(['*'], serdesFns('[*]')),
          CollCodecs.forPath(['cars', '*', 'name'], serdesFns('cars[*][name]')),
          CollCodecs.forPath(['*', 0, '*', '*'], serdesFns('[*][0][*][*]')),

          CollCodecs.forPath([], serdesFns()),
          CollCodecs.forPath(['name'], serdesFns()),
          CollCodecs.forPath(['cars'], serdesFns()),
          CollCodecs.forPath(['cars', 0], serdesFns()),
          CollCodecs.forPath(['cars', 0, 'name'], serdesFns()),
          CollCodecs.forPath(['cars', 0, 'pastOwners'], serdesFns()),
          CollCodecs.forPath(['cars', 0, 'pastOwners', '0'], serdesFns()),
          CollCodecs.forPath(['cars', 0, 'pastOwners', 'one'], serdesFns()),

          CollCodecs.forPath(['name'], serdesFns('name:1')),
          CollCodecs.forPath(['name'], serdesFns('name:2')),
          CollCodecs.forPath([], serdesFns('root:0')),

          CollCodecs.forPath(['Name'], serdesFns()),
          CollCodecs.forPath(['name', ''], serdesFns()),
          CollCodecs.forPath(['name', '0'], serdesFns()),
          CollCodecs.forPath([0], serdesFns()),
          CollCodecs.forPath([''], serdesFns()),
          CollCodecs.forPath(['cars', '1'], serdesFns()),
          CollCodecs.forPath(['cars', 'name'], serdesFns()),
          CollCodecs.forPath(['cars', '0', 'name'], serdesFns()),
          CollCodecs.forPath(['cars', 0, 'pastOwners', 0], serdesFns()),
          CollCodecs.forPath(['pastOwners'], serdesFns()),

          CollCodecs.forPath(['*', '*', '*', '*', '*'], serdesFns()),
          CollCodecs.forPath(['*', 'name'], serdesFns()),
          CollCodecs.forPath(['cars', '1', '*'], serdesFns()),
          CollCodecs.forPath(['*', '0', '*', '*'], serdesFns()),
        ],
      });

      const obj = {
        name: 'billy bob joe',
        cars: [{
          name: 'ford capri',
          pastOwners: { 0: 'brian johnson', 'one': 'angus young' },
        }],
      };

      serdes.serialize(obj);
      assert.deepStrictEqual(serPaths, [
        obj,
        'root:0',
        obj.name,
        'name:1',
        'name:2',
        '[*]',
        obj.cars,
        '[*]',
        obj.cars[0],
        obj.cars[0].name,
        'cars[*][name]',
        obj.cars[0].pastOwners,
        obj.cars[0].pastOwners[0],
        '[*][0][*][*]',
        obj.cars[0].pastOwners.one,
        '[*][0][*][*]',
      ]);

      serdes.deserialize(obj, {});
      assert.deepStrictEqual(desPaths, serPaths);
    });

    it('should keep matching the same path til done/continue', () => {
      const repeat = <T>(mk: (n: number) => T) => Array.from({ length: 10 }, (_, i) => mk(i));

      for (const signal of [ctxRecurse(), ctxDone()] as const) {
        let ser = 5, des = 5;

        const serdes = new CollectionSerDes({
          codecs: [
            ...repeat(() => CollCodecs.forPath([], {
              serialize: () => --ser ? ctxContinue() : signal,
              deserialize: () => --des ? ctxContinue() : signal,
            })),
            CollCodecs.forPath(['field'], {
              serialize: () => (--ser, ctxContinue()),
              deserialize: () => (--des, ctxContinue()),
            }),
          ],
          mutateInPlace: true,
        });

        serdes.serialize({ field: 3 });
        assert.strictEqual(ser, signal === ctxRecurse() ? -1 : 0);

        serdes.deserialize({ field: 3 }, {});
        assert.strictEqual(des, signal === ctxRecurse() ? -1 : 0);
      }
    });
  });

  describe('forId', () => {
    it('should work with explicit serdes', () => {
      class Id {
        public readonly brand = 'Id';
        constructor(public readonly unwrap: UUID) {}
      }

      const IdCodec = CollCodecs.forId({
        serialize: (val, ctx) => ctx.nevermind(val.unwrap),
        deserialize: (val, ctx) => ctx.recurse(new Id(val)),
      });

      const serdes = new CollectionSerDes({ codecs: [IdCodec], enableBigNumbers: () => 'bigint' });

      const id = new Id(uuid(4));
      const doc = { _id: id, value: 1n };

      const ser = serdes.serialize(doc);
      assert.deepStrictEqual(ser, [{ _id: { $uuid: id.unwrap.toString() }, value: 1n }, true]);

      const des = serdes.deserialize(ser[0], {});
      assert.deepStrictEqual(des, { _id: id, value: 1n });
    });

    it('should work with delegate serdes', () => {
    });
  });

  describe('forName', () => {
    it('should keep matching the same path til done/continue', () => {
      const repeat = <T>(mk: (n: number) => T) => Array.from({ length: 10 }, (_, i) => mk(i));

      for (const signal of [ctxRecurse(), ctxDone()] as const) {
        let ser = 5, des = 5;

        const serdes = new CollectionSerDes({
          codecs: [
            ...repeat(() => CollCodecs.forName('', {
              serialize: () => --ser ? ctxContinue() : signal,
              deserialize: () => --des ? ctxContinue() : signal,
            })),
            CollCodecs.forName('field', {
              serialize: () => (--ser, ctxContinue()),
              deserialize: () => (--des, ctxContinue()),
            }),
          ],
          mutateInPlace: true,
        });

        serdes.serialize({ field: 3 });
        assert.strictEqual(ser, signal === ctxRecurse() ? -1 : 0);

        serdes.deserialize({ field: 3 }, { status: { projectionSchema: { field: { type: 'int' } } } });
        assert.strictEqual(des, signal === ctxRecurse() ? -1 : 0);
      }
    });
  });
});
