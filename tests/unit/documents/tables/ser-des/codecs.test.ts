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
import type { TableCodec } from '@/src/documents/tables/index.js';
import { $DeserializeForTable, $SerializeForTable, TableCodecs } from '@/src/documents/tables/index.js';
import type { RawTableCodecs } from '@/src/documents/tables/ser-des/codecs.js';
import { processCodecs } from '@/src/lib/api/ser-des/codecs.js';
import { unitTestAsCodecClass } from '@/tests/unit/documents/__common/ser-des/as-codec-class.js';
import { TableSerDes } from '@/src/documents/tables/ser-des/ser-des.js';
import { arbs } from '@/tests/testlib/arbitraries.js';
import { unitTestForName } from '@/tests/unit/documents/__common/ser-des/for-name.js';
import fc from 'fast-check';
import { desSchema } from '@/tests/testlib/utils.js';
import { SerDesTarget } from '@/src/lib/index.js';
import { DataAPIDate, DataAPITime, DataAPIVector } from '@/src/documents/index.js';
import { BigNumber } from 'bignumber.js';
import { DataAPICreatableScalarTypes } from "@/src/db/index.js";

describe('unit.documents.tables.ser-des.codecs', () => {
  const serdes = new TableSerDes(TableSerDes.cfg.empty);

  describe('forName', () => {
    unitTestForName({
      CodecsClass: TableCodecs,
      SerDesClass: TableSerDes,
      $SerSym: $SerializeForTable,
      $DesSym: $DeserializeForTable,
    });
  });

  describe('asCodecClass', () => {
    unitTestAsCodecClass({
      CodecsClass: TableCodecs,
      SerDesClass: TableSerDes,
      $SerSym: $SerializeForTable,
      $DesSym: $DeserializeForTable,
      datatypesArb: arbs.tableDatatypes,
    });
  });

  describe('implementations', () => {
    const tableKeyArb = arbs.nonProtoString().filter(Boolean);

    for (const column of ['bigint', 'counter', 'varint'] as DataAPICreatableScalarTypes[]) {
      describe(column, () => {
        it('should deserialize integers into a BigInt', () => {
          fc.assert(
            fc.property(tableKeyArb, fc.integer(), (key, int) => {
              assert.deepStrictEqual(serdes.deserialize({ [key]: int }, desSchema({ [key]: { type: column } })), { [key]: BigInt(int) });
            }),
          );
        });

        it('should deserialize strings into a BigInt', () => {
          fc.assert(
            fc.property(tableKeyArb, fc.bigInt(), (key, bigInt) => {
              assert.deepStrictEqual(serdes.deserialize({ [key]: bigInt.toString() }, desSchema({ [key]: { type: column } })), { [key]: bigInt });
            }),
          );
        });

        it('should deserialize integers into a BigInt (primary key)', () => {
          fc.assert(
            fc.property(tableKeyArb, fc.integer(), (key, int) => {
              assert.deepStrictEqual(serdes.deserialize([int], desSchema({ [key]: { type: column } }), SerDesTarget.InsertedId), { [key]: BigInt(int) });
            }),
          );
        });

        it('should deserialize strings into a BigInt (primary key)', () => {
          fc.assert(
            fc.property(tableKeyArb, fc.bigInt(), (key, bigInt) => {
              assert.deepStrictEqual(serdes.deserialize([bigInt.toString()], desSchema({ [key]: { type: column } }), SerDesTarget.InsertedId), { [key]: bigInt });
            }),
          );
        });
      });
    }

    for (const column of ['float', 'double'] as DataAPICreatableScalarTypes[]) {
      describe(column, () => {
        const doubleArb = fc.double().map((v: number) => v === 0 ? 0 : v); // -0 not guaranteed to be preserved

        it('should deserialize floats as themselves', () => {
          fc.assert(
            fc.property(tableKeyArb, doubleArb, (key, float) => {
              assert.deepStrictEqual(serdes.deserialize({ [key]: float }, desSchema({ [key]: { type: column } })), { [key]: float });
            }),
          );
        });

        it('should deserialize strings into a float', () => {
          fc.assert(
            fc.property(tableKeyArb, doubleArb, (key, float) => {
              assert.deepStrictEqual(serdes.deserialize({ [key]: float.toString() }, desSchema({ [key]: { type: column } })), { [key]: float });
            }),
          );
        });

        it('should deserialize floats as themselves (primary key)', () => {
          fc.assert(
            fc.property(tableKeyArb, doubleArb, (key, float) => {
              assert.deepStrictEqual(serdes.deserialize([float], desSchema({ [key]: { type: column } }), SerDesTarget.InsertedId), { [key]: float });
            }),
          );
        });

        it('should deserialize strings into a float (primary key)', () => {
          fc.assert(
            fc.property(tableKeyArb, doubleArb, (key, float) => {
              assert.deepStrictEqual(serdes.deserialize([float.toString()], desSchema({ [key]: { type: column } }), SerDesTarget.InsertedId), { [key]: float });
            }),
          );
        });
      });
    }

    for (const column of ['int', 'smallint', 'tinyint'] as DataAPICreatableScalarTypes[]) {
      describe(column, () => {
        it('should deserialize integers as themselves', () => {
          fc.assert(
            fc.property(tableKeyArb, fc.integer(), (key, int) => {
              assert.deepStrictEqual(serdes.deserialize({ [key]: int }, desSchema({ [key]: { type: column } })), { [key]: int });
            }),
          );
        });

        it('should deserialize integers as themselves (primary key)', () => {
          fc.assert(
            fc.property(tableKeyArb, fc.integer(), (key, int) => {
              assert.deepStrictEqual(serdes.deserialize([int], desSchema({ [key]: { type: column } }), SerDesTarget.InsertedId), { [key]: int });
            }),
          );
        });
      });
    }

    describe('blob', () => {
      it('should serialize blobs properly', () => {
        fc.assert(
          fc.property(tableKeyArb, arbs.blob(), (key, blob) => {
            assert.deepStrictEqual(serdes.serialize({ [key]: blob }), [{ [key]: { $binary: blob.asBase64() } }, false]);
          }),
        );
      });

      it('should deserialize blobs properly', () => {
        fc.assert(
          fc.property(tableKeyArb, arbs.blob(), (key, blob) => {
            assert.deepStrictEqual(serdes.deserialize({ [key]: { $binary: blob.asBase64() } }, desSchema({ [key]: { type: 'blob' } })), { [key]: blob });
          }),
        );
      });

      it('should deserialize blobs properly (primary key)', () => {
        fc.assert(
          fc.property(tableKeyArb, arbs.blob(), (key, blob) => {
            assert.deepStrictEqual(serdes.deserialize([blob.asBase64()], desSchema({ [key]: { type: 'blob' } }), SerDesTarget.InsertedId),  { [key]: blob });
          }),
        );
      });
    });

    describe('date', () => {
      const dateArb = arbs.validDate().map((d) => new DataAPIDate(d));

      it('should serialize dates properly', () => {
        fc.assert(
          fc.property(tableKeyArb, dateArb, (key, date) => {
            assert.deepStrictEqual(serdes.serialize({ [key]: date }), [{ [key]: date.toString() }, false]);
          }),
        );
      });

      it('should deserialize dates properly', () => {
        fc.assert(
          fc.property(tableKeyArb, dateArb, (key, date) => {
            assert.deepStrictEqual(serdes.deserialize({ [key]: date.toString() }, desSchema({ [key]: { type: 'date' } })), { [key]: date });
          }),
        );
      });

      it('should deserialize dates properly (primary key)', () => {
        fc.assert(
          fc.property(tableKeyArb, dateArb, (key, date) => {
            assert.deepStrictEqual(serdes.deserialize([date.toString()], desSchema({ [key]: { type: 'date' } }), SerDesTarget.InsertedId), { [key]: date });
          }),
        );
      });
    });

    describe('inet', () => {
      it('should serialize inet addresses properly', () => {
        fc.assert(
          fc.property(tableKeyArb, arbs.inet(), (key, inet) => {
            assert.deepStrictEqual(serdes.serialize({ [key]: inet }), [{ [key]: inet.toString() }, false]);
          }),
        );
      });

      it('should deserialize inet addresses properly', () => {
        fc.assert(
          fc.property(tableKeyArb, arbs.inet(), (key, inet) => {
            assert.deepStrictEqual(serdes.deserialize({ [key]: inet.toString() }, desSchema({ [key]: { type: 'inet' } })), { [key]: inet });
          }),
        );
      });

      it('should deserialize inet addresses properly (primary key)', () => {
        fc.assert(
          fc.property(tableKeyArb, arbs.inet(), (key, inet) => {
            assert.deepStrictEqual(serdes.deserialize([inet.toString()], desSchema({ [key]: { type: 'inet' } }), SerDesTarget.InsertedId), { [key]: inet });
          }),
        );
      });
    });

    describe('time', () => {
      const timeArb = arbs.validDate().map((d) => new DataAPITime(d));

      it('should serialize dates properly', () => {
        fc.assert(
          fc.property(tableKeyArb, timeArb, (key, time) => {
            assert.deepStrictEqual(serdes.serialize({ [key]: time }), [{ [key]: time.toString() }, false]);
          }),
        );
      });

      it('should deserialize dates properly', () => {
        fc.assert(
          fc.property(tableKeyArb, timeArb, (key, time) => {
            assert.deepStrictEqual(serdes.deserialize({ [key]: time.toString() }, desSchema({ [key]: { type: 'time' } })), { [key]: time });
          }),
        );
      });

      it('should deserialize dates properly (primary key)', () => {
        fc.assert(
          fc.property(tableKeyArb, timeArb, (key, time) => {
            assert.deepStrictEqual(serdes.deserialize([time.toString()], desSchema({ [key]: { type: 'time' } }), SerDesTarget.InsertedId), { [key]: time });
          }),
        );
      });
    });

    describe('timestamp', () => {
      it('should serialize the date into the proper format', () => {
        fc.assert(
          fc.property(tableKeyArb, arbs.validDate(), (key, date) => {
            assert.deepStrictEqual(serdes.serialize({ [key]: date }), [{ [key]: date.toISOString() }, false]);
          }),
        );
      });

      it('should error on an invalid date attempting to be serialized', () => {
        assert.throws(() => serdes.serialize({ date: new Date(NaN) }), {
          message: 'Can not serialize an invalid date (at \'date\')',
        });
      });

      it('should deserialize the date properly', () => {
        fc.assert(
          fc.property(tableKeyArb, arbs.validDate(), (key, date) => {
            assert.deepStrictEqual(serdes.deserialize({ [key]: date.toISOString() }, desSchema({ [key]: { type: 'timestamp' } })), { [key]: date });
          }),
        );
      });
    });

    describe('vector', () => {
      it('should serialize vectors properly', () => {
        fc.assert(
          fc.property(tableKeyArb, arbs.vector(), (key, vector) => {
            assert.deepStrictEqual(serdes.serialize({ [key]: vector }), [{ [key]: { $binary: vector.asBase64() } }, false]);
          }),
        );
      });

      it('should deserialize vectors from { $binary }s properly', () => {
        fc.assert(
          fc.property(tableKeyArb, fc.integer({ min: 1, max: 999 }).chain(dim => fc.tuple(fc.constant(dim), arbs.vector({ dim }))), (key, [dim, vector]) => {
            assert.deepStrictEqual(serdes.deserialize({ [key]: { $binary: vector.asBase64() } }, desSchema({ [key]: { type: 'vector', dimension: dim } })), { [key]: new DataAPIVector({ $binary: vector.asBase64() }) });
          }),
        );
      });

      it('should deserialize vectors from number[]s properly', () => {
        fc.assert(
          fc.property(tableKeyArb, fc.integer({ min: 1, max: 9999 }).chain(dim => fc.tuple(fc.constant(dim), arbs.vector({ dim }))), (key, [dim, vector]) => {
            assert.deepStrictEqual(serdes.deserialize({ [key]: vector.asArray() }, desSchema({ [key]: { type: 'vector', dimension: dim } })), { [key]: vector });
          }),
        );
      });
    });

    describe('map', () => {
      const stringKVsArb = fc.nat(25).chain((n) => {
        return fc.tuple(
          fc.array(fc.string(), { minLength: n, maxLength: n }),
          arbs.tableDatatypes({ scalarOnly: true, count: n }),
        );
      });

      const anyKVsArb = fc.nat(25).chain((n) => {
        return fc.tuple(
          arbs.tableDatatypes({ scalarOnly: true, count: n }),
          arbs.tableDatatypes({ scalarOnly: true, count: n }),
        );
      });

      it('should serialize a map as an alist if it has >0 entries', () => {
        fc.assert(
          fc.property(tableKeyArb, anyKVsArb, (key, [keys, values]) => {
            const map = new Map(keys.map((k, i) => [k.jsRep, values[i].jsRep]));
            fc.pre(map.size > 0);

            const expectedObj = [...new Map(keys.map((k, i) => [k.jsonRep, values[i].jsonRep]))];
            fc.pre(map.size === expectedObj.length);

            const bigNumsPresent = keys.some((k) => k.jsRep instanceof BigNumber) || values.some((v) => v.jsRep instanceof BigNumber);

            assert.deepStrictEqual(serdes.serialize({ [key]: map }), [{ [key]: expectedObj }, bigNumsPresent]);
          }),
        );
      });

      // TODO - change when https://github.com/stargate/data-api/issues/2005 resolved
      it('should serialize a map as an empty object if it has 0 entries', () => {
        fc.assert(
          fc.property(tableKeyArb, (key) => {
            assert.deepStrictEqual(serdes.serialize({ [key]: new Map }), [{ [key]: {} }, false]);
          }),
        );
      });

      // TODO - change when https://github.com/stargate/data-api/issues/2005 resolved
      it('should serialize a normal object as an object normally', () => {
        fc.assert(
          fc.property(tableKeyArb, stringKVsArb, (key, [keys, values]) => {
            const obj = Object.fromEntries(keys.map((k, i) => [k, values[i].jsRep]));
            const expectedObj = Object.fromEntries(keys.map((k, i) => [k, values[i].jsonRep]));

            const bigNumsPresent = values.some((v) => v.jsRep instanceof BigNumber);

            assert.deepStrictEqual(serdes.serialize({ [key]: obj }), [{ [key]: expectedObj }, bigNumsPresent]);
          }),
        );
      });

      it('should recurse over an object when deserializing', () => {
        fc.assert(
          fc.property(tableKeyArb, stringKVsArb, (key, [keys, values]) => {
            const seenMap = new Map(keys.map((k, i) => [k, values[i].jsonRep]));

            const codec = TableCodecs.custom({
              deserializeGuard(val, ctx) {
                if (ctx.path.length === 2) {
                  const key = ctx.path[1] as string;
                  assert.strictEqual(val, seenMap.get(key));
                  seenMap.delete(key);
                }
                return false;
              },
              deserialize: () => {
                throw new Error('Should not be called');
              },
            });

            const serdes = new TableSerDes({ ...TableSerDes.cfg.empty, codecs: [codec] });
            const schema = desSchema({ [key]: { type: 'map', valueType: values.definition.type } });

            const obj = Object.fromEntries(keys.map((k, i) => [k, values[i].jsonRep]));
            const expectMap = new Map(keys.map((k, i) => [k, values[i].jsRep]));

            assert.strictEqual(seenMap.size, expectMap.size);
            assert.deepStrictEqual(serdes.deserialize({ [key]: obj }, schema), { [key]: expectMap });
            assert.strictEqual(seenMap.size, 0);
          }),{ seed: -1399328513, path: "0:0:0:0:0:1:1:0:0:0", endOnFailure: true }
        );
      });

      it('should recurse over an association list when deserializing', () => {
        fc.assert(
          fc.property(tableKeyArb, anyKVsArb, (key, [keys, values]) => {
            const seenArray = keys.map((k, i) => [k, values[i].jsonRep]);
            let i = 0;

            const codec = TableCodecs.custom({
              deserializeGuard(kv, ctx) {
                if (ctx.path.length === 2) {
                  const index = ctx.path[1] as number;
                  assert.strictEqual(index, i++);
                  assert.strictEqual(kv[0], seenArray[index][0]);
                  assert.strictEqual(kv[1], seenArray[index][1]);
                  seenArray[index] = null!;
                }
                return false;
              },
              deserialize: () => {
                throw new Error('Should not be called');
              },
            });

            const serdes = new TableSerDes({ ...TableSerDes.cfg.empty, codecs: [codec] });
            const schema = desSchema({ [key]: { type: 'map', keyType: keys.definition.type, valueType: values.definition.type } });

            const arr = keys.map((k, i) => [k, values[i].jsonRep]);
            const expectMap = new Map(keys.map((k, i) => [k, values[i].jsRep]));

            assert.strictEqual(seenArray.length, expectMap.size);
            assert.deepStrictEqual(serdes.deserialize({ [key]: arr }, schema), { [key]: expectMap });
            assert.strictEqual(seenArray.filter(Boolean).length, 0);
            assert.strictEqual(i, expectMap.size);
          }),{ seed: -1856377880, path: "0:0:0:0:0:1:1:0:0", endOnFailure: true }
        );
      });
    });

    describe('set', () => {
      it('should serialize a set as a list', () => {
        fc.assert(
          fc.property(tableKeyArb, arbs.tableDatatypes({ scalarOnly: true }), (key, values) => {

            const jsSet = new Set(values.map((v) => v.jsRep));
            const jsonArr = [...new Set(values.map((v) => v.jsonRep))];
            fc.pre(jsSet.size === jsonArr.length);

            const bigNumsPresent = values.some((v) => v.jsRep instanceof BigNumber);

            assert.deepStrictEqual(serdes.serialize({ [key]: jsSet }), [{ [key]: jsonArr }, bigNumsPresent]);
          }),
        );
      });

      it('should deserialize a list into a set', () => {
        fc.assert(
          fc.property(tableKeyArb, arbs.tableDatatypes({ scalarOnly: true }), (key, values) => {
            const seenSet = new Set(values.map((v) => v.jsonRep));
            let i = 0;

            const codec = TableCodecs.custom({
              deserializeGuard(val, ctx) {
                if (ctx.path.length === 2) {
                  assert.strictEqual(ctx.path.at(-1), i++);
                  seenSet.delete(val);
                }
                return false;
              },
              deserialize: () => {
                throw new Error('Should not be called');
              },
            });

            const serdes = new TableSerDes({ ...TableSerDes.cfg.empty, codecs: [codec] });
            const schema = desSchema({ [key]: { type: 'set', valueType: values.definition.type } });

            const arr = [...values.map((v) => v.jsonRep)];
            const expectSet = new Set(values.map((v) => v.jsRep));

            assert.strictEqual(seenSet.size, new Set(arr).size);
            assert.deepStrictEqual(serdes.deserialize({ [key]: arr }, schema), { [key]: expectSet });
            assert.strictEqual(seenSet.size, 0);
            assert.strictEqual(i, arr.length); // arr.length instead of expectSet.size because deserialization should run before set conversion
          }),
        );
      });
    });
  });

  describe('unsupported datatypes', () => {
    it('should error when trying to serialize an ObjectId', () => {
      fc.assert(
        fc.property(arbs.oid(), (oid) => {
          assert.throws(() => serdes.serialize(oid), { message: /ObjectId may not be used with tables by default\..*/ });
        }),
      );
    });
  });

  describe('processCodecs', () => {
    it('should properly process raw codecs', () => {
      const fake = (id: string) => id as unknown as () => readonly [0] & boolean;

      const repeat = <T>(fn: (i: number) => T) => Array.from({ length: 3 }, (_, i) => fn(i));

      class Delegate implements TableCodec<typeof Delegate> {
        static [$DeserializeForTable] = fake('$DeserializeForTable');
        [$SerializeForTable] = fake('$SerializeForTable');
      }

      const codecs: RawTableCodecs[] = [
        repeat((i) => [
          TableCodecs.forName(`name${i}`, Delegate),
          TableCodecs.forName(`name${i}`, { serialize: fake(`name${i}:ser_fn`) }),
          TableCodecs.forName(`name${i}`, { deserialize: fake(`name${i}:des_fn`) }),
          TableCodecs.forName(`name${i}`, { serialize: fake(`name${i}:serdes_fn`), deserialize: fake(`name${i}:serdes_fn`) }),
        ]).flat(),

        repeat((i) => [
          TableCodecs.forType(`type${i}`, Delegate),
          TableCodecs.forType(`type${i}`, { serialize: fake(`type${i}:ser_fn/class`), serializeClass: Delegate }),
          TableCodecs.forType(`type${i}`, { serialize: fake(`type${i}:ser_fn/guard`), serializeGuard: fake(`type${i}:ser_guard`) }),
          TableCodecs.forType(`type${i}`, { deserialize: fake(`type${i}:des_fn`) }),
        ]).flat(),

        repeat((i) => [
          TableCodecs.custom({ serialize: fake(`custom${i}:ser_fn/class`), serializeClass: Delegate }),
          TableCodecs.custom({ serialize: fake(`custom${i}:ser_fn/guard`), serializeGuard: fake(`custom${i}:ser_guard`) }),
          TableCodecs.custom({ deserialize: fake(`custom${i}:des_fn`), deserializeGuard: fake(`custom${i}:des_guard`) }),
        ]).flat(),
      ].flat();

      const processed = processCodecs(codecs.flat());

      assert.deepStrictEqual(processed, [
        {
          forName: Object.assign(Object.create(null), {
            ...Object.fromEntries(repeat((i) => [`name${i}`, [`name${i}:ser_fn`, `name${i}:serdes_fn`]])),
          }),
          forClass: [
            { class: Delegate, fns: [...repeat((i) => `type${i}:ser_fn/class`), ...repeat((i) => `custom${i}:ser_fn/class`)] },
          ],
          forGuard: [
            ...repeat((i) => ({ guard: `type${i}:ser_guard`, fn: `type${i}:ser_fn/guard` })),
            ...repeat((i) => ({ guard: `custom${i}:ser_guard`, fn: `custom${i}:ser_fn/guard` })),
          ],
          forPath: Object.assign(Object.create(null), {}),
        },
        {
          forName: Object.assign(Object.create(null), {
            ...Object.fromEntries(repeat((i) => [`name${i}`, ['$DeserializeForTable', `name${i}:des_fn`, `name${i}:serdes_fn`]])),
          }),
          forType: Object.assign(Object.create(null), {
            ...Object.fromEntries(repeat((i) => [`type${i}`, ['$DeserializeForTable', `type${i}:des_fn`]])),
          }),
          forGuard: [
            ...repeat((i) => ({ guard: `custom${i}:des_guard`, fn: `custom${i}:des_fn` })),
          ],
          forPath: Object.assign(Object.create(null), {}),
        },
      ]);
    });
  });
});
