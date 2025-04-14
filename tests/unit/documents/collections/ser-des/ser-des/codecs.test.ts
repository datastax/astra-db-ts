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
import assert from 'assert';
import type { CollectionDesCtx, CollectionSerCtx } from '@/src/documents/collections/ser-des/ser-des.js';
import { CollSerDes } from '@/src/documents/collections/ser-des/ser-des.js';
import type { CollectionCodec} from '@/src/documents/collections/index.js';
import { $DeserializeForCollection, $SerializeForCollection, CollectionCodecs } from '@/src/documents/collections/index.js';
import type { UUID } from '@/src/documents/index.js';
import { uuid } from '@/src/documents/index.js';
import { ctxNevermind, ctxDone, ctxRecurse } from '@/src/lib/api/ser-des/ctx.js';

describe('unit.documents.collections.ser-des.ser-des.codecs', () => {
  describe('forPath', () => {
    it('should match a variety of paths', () => {
      const serPaths = [] as unknown[];
      const desPaths = [] as unknown[];

      const visit = (arr: unknown[], v: unknown) => (value: unknown) => (arr.push(v ?? value), ctxNevermind());
      const serdesFns = (v: unknown = null) => ({ serialize: visit(serPaths, v), deserialize: visit(desPaths, v) });

      const serdes = new CollSerDes({
        ...CollSerDes.cfg.empty,
        codecs: [
          CollectionCodecs.forPath(['*'], serdesFns('[*]')),
          CollectionCodecs.forPath(['cars', '*', 'name'], serdesFns('cars[*][name]')),
          CollectionCodecs.forPath(['*', 0, '*', '*'], serdesFns('[*][0][*][*]')),

          CollectionCodecs.forPath([], serdesFns()),
          CollectionCodecs.forPath(['name'], serdesFns()),
          CollectionCodecs.forPath(['cars'], serdesFns()),
          CollectionCodecs.forPath(['cars', 0], serdesFns()),
          CollectionCodecs.forPath(['cars', 0, 'name'], serdesFns()),
          CollectionCodecs.forPath(['cars', 0, 'pastOwners'], serdesFns()),
          CollectionCodecs.forPath(['cars', 0, 'pastOwners', '0'], serdesFns()),
          CollectionCodecs.forPath(['cars', 0, 'pastOwners', 'one'], serdesFns()),

          CollectionCodecs.forPath(['name'], serdesFns('name:1')),
          CollectionCodecs.forPath(['name'], serdesFns('name:2')),
          CollectionCodecs.forPath([], serdesFns('root:0')),

          CollectionCodecs.forPath(['Name'], serdesFns()),
          CollectionCodecs.forPath(['name', ''], serdesFns()),
          CollectionCodecs.forPath(['name', '0'], serdesFns()),
          CollectionCodecs.forPath([0], serdesFns()),
          CollectionCodecs.forPath([''], serdesFns()),
          CollectionCodecs.forPath(['cars', '1'], serdesFns()),
          CollectionCodecs.forPath(['cars', 'name'], serdesFns()),
          CollectionCodecs.forPath(['cars', '0', 'name'], serdesFns()),
          CollectionCodecs.forPath(['cars', 0, 'pastOwners', 0], serdesFns()),
          CollectionCodecs.forPath(['pastOwners'], serdesFns()),

          CollectionCodecs.forPath(['*', '*', '*', '*', '*'], serdesFns()),
          CollectionCodecs.forPath(['*', 'name'], serdesFns()),
          CollectionCodecs.forPath(['cars', '1', '*'], serdesFns()),
          CollectionCodecs.forPath(['*', '0', '*', '*'], serdesFns()),
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

        const serdes = new CollSerDes({
          ...CollSerDes.cfg.empty,
          codecs: [
            ...repeat(() => CollectionCodecs.forPath([], {
              serialize: () => --ser ? ctxNevermind() : signal,
              deserialize: () => --des ? ctxNevermind() : signal,
            })),
            CollectionCodecs.forPath(['field'], {
              serialize: () => (--ser, ctxNevermind()),
              deserialize: () => (--des, ctxNevermind()),
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
    it('should work with delegate serdes', () => {
      class Id implements CollectionCodec<typeof Id> {
        public readonly brand = 'Id';
        constructor(public readonly unwrap: UUID) {}

        static [$DeserializeForCollection](val: any, ctx: CollectionDesCtx) {
          return ctx.recurse(new Id(val));
        }

        [$SerializeForCollection](ctx: CollectionSerCtx) {
          return ctx.replace(this.unwrap);
        }
      }

      const IdCodec = CollectionCodecs.forId(Id);
      const serdes = new CollSerDes({ ...CollSerDes.cfg.empty, codecs: [IdCodec], enableBigNumbers: () => 'bigint' });

      const id = new Id(uuid.v4());
      const doc = { _id: id, value: 1n };

      const ser = serdes.serialize(doc);
      assert.deepStrictEqual(ser, [{ _id: { $uuid: id.unwrap.toString() }, value: 1n }, true]);

      const des = serdes.deserialize(ser[0], {});
      assert.deepStrictEqual(des, { _id: id, value: 1n });
    });
  });
});
