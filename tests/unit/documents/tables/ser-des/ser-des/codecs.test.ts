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
import { TableSerDes } from '@/src/documents/tables/ser-des/ser-des';
import { ctxDone, ctxNevermind, ctxRecurse } from '@/src/lib/api/ser-des/ctx';
import { TableCodecs, uuid } from '@/src/documents';

describe('unit.documents.tables.ser-des.ser-des.codecs', () => {
  describe('forPath', () => {
    it('should match a variety of paths', () => {
      const serPaths = [] as unknown[];
      const desPaths = [] as unknown[];

      const visit = (arr: unknown[], v: unknown) => (value: unknown) => (arr.push(v ?? value), ctxNevermind());
      const serdesFns = (v: unknown = null) => ({ serialize: visit(serPaths, v), deserialize: visit(desPaths, v) });
      const uuid1 = uuid(1);
      const uuid4 = uuid(4);

      const serdes = new TableSerDes({
        ...TableSerDes.cfg.empty,
        codecs: [
          TableCodecs.forPath(['*'], serdesFns('[*]')),
          TableCodecs.forPath(['*', '*'], serdesFns('[*][*]')),
          TableCodecs.forPath(['*', 2], serdesFns('[*][2]')),

          TableCodecs.forPath([], serdesFns()),
          TableCodecs.forPath(['name'], serdesFns()),
          TableCodecs.forPath(['cars'], serdesFns()),
          TableCodecs.forPath(['cars', 'ford capri'], serdesFns()),
          TableCodecs.forPath(['nums', 2], serdesFns()),

          TableCodecs.forPath(['name'], serdesFns('name:1')),
          TableCodecs.forPath(['name'], serdesFns('name:2')),
          TableCodecs.forPath([], serdesFns('root:0')),

          TableCodecs.forPath(['Name'], serdesFns()),
          TableCodecs.forPath(['name', ''], serdesFns()),
          TableCodecs.forPath(['cars', 0], serdesFns()),
          TableCodecs.forPath(['nums', '0'], serdesFns()),
          TableCodecs.forPath(['ford capri'], serdesFns()),
          TableCodecs.forPath([''], serdesFns()),
          TableCodecs.forPath([0], serdesFns()),

          TableCodecs.forPath(['*', '2'], serdesFns()),
          TableCodecs.forPath(['*', '*', '*'], serdesFns()),
        ],
      });

      const obj = {
        name: 'billy bob joe',
        cars: new Map([['ford capri', uuid1], ['chevy impala', uuid4]]),
        nums: new Set([1n, 2n, 3n]),
      };

      const serialized = {
        name: 'billy bob joe',
        cars: { 'ford capri': uuid1.toString(), 'chevy impala': uuid4.toString() },
        nums: [1n, 2n, 3n],
      };

      assert.deepStrictEqual(serdes.serialize(obj), [serialized, true]);
      assert.deepStrictEqual(serPaths, [
        obj,
        'root:0',
        obj.name,
        'name:1',
        'name:2',
        '[*]',
        obj.cars,
        '[*]',
        obj.cars.get('ford capri'),
        '[*][*]',
        '[*][*]',
        '[*]',
        '[*][*]',
        '[*][*]',
        3n,
        '[*][2]',
        '[*][*]',
      ]);

      assert.deepStrictEqual(serdes.deserialize(serialized, {
        status: {
          projectionSchema: {
            name: { type: 'text' },
            cars: { type: 'map', keyType: 'text', valueType: 'uuid' },
            nums: { type: 'set', valueType: 'bigint' },
          },
        },
      }), obj);
      assert.deepStrictEqual(desPaths, [
        'root:0',
        obj,
        '[*]',
        'name:2',
        'name:1',
        obj.name,
        '[*]',
        Object.fromEntries(obj.cars),
        '[*][*]',
        obj.cars.get('ford capri')!.toString(),
        '[*][*]',
        '[*]',
        '[*][*]',
        '[*][*]',
        '[*][*]',
        '[*][2]',
        3n,
      ]);
    });

    it('should keep matching the same path til done/continue', () => {
      const repeat = <T>(mk: (n: number) => T) => Array.from({ length: 10 }, (_, i) => mk(i));

      for (const signal of [ctxRecurse(), ctxDone()] as const) {
        let ser = 5, des = 5;

        const serdes = new TableSerDes({
          ...TableSerDes.cfg.empty,
          codecs: [
            ...repeat(() => TableCodecs.forPath([], {
              serialize: () => --ser ? ctxNevermind() : signal,
              deserialize: () => --des ? ctxNevermind() : signal,
            })),
            TableCodecs.forPath(['field'], {
              serialize: () => (--ser, ctxNevermind()),
              deserialize: () => (--des, ctxNevermind()),
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
