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
import { ctxContinue, ctxDone, ctxNevermind } from '@/src/lib/api/ser-des/ctx';

describe('unit.documents.collections.ser-des.ser-des.codecs', () => {
  describe('forPath', () => {
    it('should match a variety of paths', () => {
      const serPaths = [] as unknown[];
      const desPaths = [] as unknown[];

      const visit = (arr: unknown[], v: unknown) => (value: unknown) => (arr.push(v ?? value), ctxNevermind());
      const serdesFns = (v: unknown = null) => ({ serialize: visit(serPaths, v), deserialize: visit(desPaths, v) });

      const serdes = new CollectionSerDes({
        codecs: [
          CollCodecs.forPath([], serdesFns()),
          CollCodecs.forPath(['name'], serdesFns()),
          CollCodecs.forPath(['cars'], serdesFns()),
          CollCodecs.forPath(['cars', '0'], serdesFns()),
          CollCodecs.forPath(['cars', '0', 'name'], serdesFns()),
          CollCodecs.forPath(['cars', '0', 'pastOwners'], serdesFns()),
          CollCodecs.forPath(['cars', '0', 'pastOwners', '0'], serdesFns()),
          CollCodecs.forPath(['cars', '0', 'pastOwners', 'one'], serdesFns()),

          CollCodecs.forPath(['name'], serdesFns(1)),
          CollCodecs.forPath(['name'], serdesFns(2)),
          CollCodecs.forPath([], serdesFns(0)),

          CollCodecs.forPath(['Name'], serdesFns()),
          CollCodecs.forPath(['name', ''], serdesFns()),
          CollCodecs.forPath(['name', '0'], serdesFns()),
          CollCodecs.forPath(['0'], serdesFns()),
          CollCodecs.forPath([''], serdesFns()),
          CollCodecs.forPath(['cars', '1'], serdesFns()),
          CollCodecs.forPath(['cars', 'name'], serdesFns()),
          CollCodecs.forPath(['cars', '0', '0'], serdesFns()),
          CollCodecs.forPath(['pastOwners'], serdesFns()),
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
        0,
        obj.name,
        1,
        2,
        obj.cars,
        obj.cars[0],
        obj.cars[0].name,
        obj.cars[0].pastOwners,
        obj.cars[0].pastOwners[0],
        obj.cars[0].pastOwners.one,
      ]);

      serdes.deserialize(obj, {});
      assert.deepStrictEqual(serPaths, desPaths);
    });

    it('should keep matching the same path til done/continue', () => {
      const repeat = <T>(mk: (n: number) => T) => Array.from({ length: 10 }, (_, i) => mk(i));

      for (const signal of [ctxContinue(), ctxDone()] as const) {
        let ser = 5, des = 5;

        const serdes = new CollectionSerDes({
          codecs: [
            ...repeat(() => CollCodecs.forPath([], {
              serialize: () => --ser ? ctxNevermind() : signal,
              deserialize: () => --des ? ctxNevermind() : signal,
            })),
            CollCodecs.forPath(['field'], {
              serialize: () => (--ser, ctxNevermind()),
              deserialize: () => (--des, ctxNevermind()),
            }),
          ],
          mutateInPlace: true,
        });

        serdes.serialize({ field: 3 });
        assert.strictEqual(ser, signal === ctxContinue() ? -1 : 0);

        serdes.deserialize({ field: 3 }, {});
        assert.strictEqual(des, signal === ctxContinue() ? -1 : 0);
      }
    });
  });
});
