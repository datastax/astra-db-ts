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
import type { CollectionCodec } from '@/src/documents/index.js';
import {
  $DeserializeForCollection,
  $SerializeForCollection,
  CollectionCodecs,
  DataAPIDate,
  DataAPIDuration,
  DataAPITime,
  DataAPIVector,
  vector,
} from '@/src/documents/index.js';
import type { RawCollCodecs } from '@/src/documents/collections/ser-des/codecs.js';
import { processCodecs } from '@/src/lib/api/ser-des/codecs.js';
import { unitTestAsCodecClass } from '@/tests/unit/documents/__common/ser-des/as-codec-class.js';
import { arbs } from '@/tests/testlib/arbitraries.js';
import { CollSerDes } from '@/src/documents/collections/ser-des/ser-des.js';
import { unitTestForName } from '@/tests/unit/documents/__common/ser-des/for-name.js';
import fc from 'fast-check';

describe('unit.documents.collections.ser-des.codecs', () => {
  const serdes = new CollSerDes(CollSerDes.cfg.empty);

  describe('forName', () => {
    unitTestForName({
      CodecsClass: CollectionCodecs,
      SerDesClass: CollSerDes,
      $SerSym: $SerializeForCollection,
      $DesSym: $DeserializeForCollection,
    });
  });

  describe('asCodecClass', () => {
    unitTestAsCodecClass({
      CodecsClass: CollectionCodecs,
      SerDesClass: CollSerDes,
      $SerSym: $SerializeForCollection,
      $DesSym: $DeserializeForCollection,
      datatypesArb: arbs.collDatatypes,
    });
  });

  describe('implementations', () => {
    describe('$date', () => {
      it('should serialize the date into the proper format', () => {
        fc.assert(
          fc.property(arbs.validDate(), (date) => {
            assert.deepStrictEqual(serdes.serialize(date), [{ $date: date.valueOf() }, false]);
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
          fc.property(arbs.validDate(), (date) => {
            assert.deepStrictEqual(serdes.deserialize({ $date: date.valueOf() }, {}), date);
          }),
        );
      });
    });

    describe('$vector', () => {
      it('should $binary-ify any DataAPIVectorLike and ignore the rest', () => {
        const arb = fc.oneof(
          fc.anything(),
          arbs.vector().map(v => v.asArray()),
          arbs.vector().map(v => v.asFloat32Array()),
          arbs.vector().map(v => ({ $binary: v.asBase64() })),
          arbs.vector(),
        );

        fc.assert(
          fc.property(arb, (anything) => {
            if (DataAPIVector.isVectorLike(anything)) {
              assert.deepStrictEqual(serdes.serialize({ $vector: anything }), [{ $vector: { $binary: vector(anything).asBase64() } }, false]);
            } else {
              assert.deepStrictEqual(serdes.serialize({ $vector: anything }), [{ $vector: anything }, false]);
            }
          }),
        );
      });

      it('should deserialize number[]s into DataAPIVectors', () => {
        fc.assert(
          fc.property(arbs.vector(), (vector) => {
            assert.deepStrictEqual(serdes.deserialize({ $vector: vector.asArray() }, {}), { $vector: vector });
          }),
        );
      });

      it('should deserialize { $binary }s into DataAPIVectors', () => {
        fc.assert(
          fc.property(arbs.vector().map(v => v.asBase64()), (base64) => {
            assert.deepStrictEqual(serdes.deserialize({ $vector: { $binary: base64 } }, {}), { $vector: vector({ $binary: base64 }) });
          }),
        );
      });
    });

    describe('$uuid', () => {
      it('should serialize uuids properly', () => {
        fc.assert(
          fc.property(arbs.uuid(), (uuid) => {
            assert.deepStrictEqual(serdes.serialize(uuid), [{ $uuid: uuid.toString() }, false]);
          }),
        );
      });

      it('should deserialize uuids properly', () => {
        fc.assert(
          fc.property(arbs.uuid(), (uuid) => {
            assert.deepStrictEqual(serdes.deserialize({ $uuid: uuid.toString() }, {}), uuid);
          }),
        );
      });
    });

    describe('$objectId', () => {
      it('should serialize object ids properly', () => {
        fc.assert(
          fc.property(arbs.oid(), (objectId) => {
            assert.deepStrictEqual(serdes.serialize(objectId), [{ $objectId: objectId.toString() }, false]);
          }),
        );
      });

      it('should deserialize object ids properly', () => {
        fc.assert(
          fc.property(arbs.oid(), (objectId) => {
            assert.deepStrictEqual(serdes.deserialize({ $objectId: objectId.toString() }, {}), objectId);
          }),
        );
      });
    });
  });

  describe('unsupported datatypes', () => {
    const datatypes: [string, fc.Arbitrary<unknown>][] = [
      ['DataAPIBlob', arbs.blob()],
      ['DataAPIDate', arbs.validDate().map(d => new DataAPIDate(d))],
      ['DataAPITime', arbs.validDate().map(d => new DataAPITime(d))],
      ['DataAPIDuration', fc.tuple(fc.nat(), fc.nat(), fc.nat()).map(([m, d, ns]) => new DataAPIDuration(m, d, ns))],
      ['DataAPIInet', arbs.inet()],
    ];

    for (const [type, arb] of datatypes) {
      it(`should error when trying to serialize a ${type}`, () => {
        fc.assert(
          fc.property(arb, (value) => {
            assert.throws(() => serdes.serialize(value), { message: new RegExp(`${type} may not be used with collections by default\\..*`) });
          }),
        );
      });
    }
  });

  describe('processCodecs', () => {
    it('should properly process raw codecs', () => {
      const fake = (id: string) => id as unknown as () => readonly [0] & boolean;

      const repeat = <T>(fn: (i: number) => T) => Array.from({ length: 3 }, (_, i) => fn(i));

      class Delegate implements CollectionCodec<typeof Delegate> {
        static [$DeserializeForCollection] = fake('$DeserializeForCollection');
        [$SerializeForCollection] = fake('$SerializeForCollection');
      }

      const codecs: RawCollCodecs[] = [
        repeat((i) => [
          CollectionCodecs.forName(`name${i}`, Delegate),
          CollectionCodecs.forName(`name${i}`, { serialize: fake(`name${i}:ser_fn`) }),
          CollectionCodecs.forName(`name${i}`, { deserialize: fake(`name${i}:des_fn`) }),
          CollectionCodecs.forName(`name${i}`, { serialize: fake(`name${i}:serdes_fn`), deserialize: fake(`name${i}:serdes_fn`) }),
        ]).flat(),

        repeat((i) => [
          CollectionCodecs.forPath(['pa', 'th', `${i}`], Delegate),
          CollectionCodecs.forPath(['pa', 'th', `${i}`], { serialize: fake(`path${i}:ser_fn`) }),
          CollectionCodecs.forPath(['pa', 'th', `${i}`], { deserialize: fake(`path${i}:des_fn`) }),
          CollectionCodecs.forPath(['pa', 'th', `${i}`], { serialize: fake(`path${i}:serdes_fn`), deserialize: fake(`path${i}:serdes_fn`) }),
        ]).flat(),

        repeat((i) => [
          CollectionCodecs.forType(`type${i}`, Delegate),
          CollectionCodecs.forType(`type${i}`, { serialize: fake(`type${i}:ser_fn/class`), serializeClass: Delegate }),
          CollectionCodecs.forType(`type${i}`, { serialize: fake(`type${i}:ser_fn/guard`), serializeGuard: fake(`type${i}:ser_guard`) }),
          CollectionCodecs.forType(`type${i}`, { deserialize: fake(`type${i}:des_fn`) }),
        ]).flat(),

        repeat((i) => [
          CollectionCodecs.custom({ serialize: fake(`custom${i}:ser_fn/class`), serializeClass: Delegate }),
          CollectionCodecs.custom({ serialize: fake(`custom${i}:ser_fn/guard`), serializeGuard: fake(`custom${i}:ser_guard`) }),
          CollectionCodecs.custom({ deserialize: fake(`custom${i}:des_fn`), deserializeGuard: fake(`custom${i}:des_guard`) }),
        ]).flat(),
      ].flat();

      const processed = processCodecs(codecs.flat());

      assert.deepStrictEqual(processed, [
        {
          forName: Object.assign(Object.create(null), {
            ...Object.fromEntries(repeat((i) => [`name${i}`, [`name${i}:ser_fn`, `name${i}:serdes_fn`]])),
          }),
          forPath: Object.assign(Object.create(null), {
            ['3']: repeat((i) => ({ path: ['pa', 'th', `${i}`], fns: [`path${i}:ser_fn`, `path${i}:serdes_fn`] })),
          }),
          forClass: [
            { class: Delegate, fns: [...repeat((i) => `type${i}:ser_fn/class`), ...repeat((i) => `custom${i}:ser_fn/class`)] },
          ],
          forGuard: [
            ...repeat((i) => ({ guard: `type${i}:ser_guard`, fn: `type${i}:ser_fn/guard` })),
            ...repeat((i) => ({ guard: `custom${i}:ser_guard`, fn: `custom${i}:ser_fn/guard` })),
          ],
        },
        {
          forName: Object.assign(Object.create(null), {
            ...Object.fromEntries(repeat((i) => [`name${i}`, ['$DeserializeForCollection', `name${i}:des_fn`, `name${i}:serdes_fn`]])),
          }),
          forPath: Object.assign(Object.create(null), {
            ['3']: repeat((i) => ({ path: ['pa', 'th', `${i}`], fns: ['$DeserializeForCollection', `path${i}:des_fn`, `path${i}:serdes_fn`] })),
          }),
          forType: Object.assign(Object.create(null), {
            ...Object.fromEntries(repeat((i) => [`type${i}`, ['$DeserializeForCollection', `type${i}:des_fn`]])),
          }),
          forGuard: [
            ...repeat((i) => ({ guard: `custom${i}:des_guard`, fn: `custom${i}:des_fn` })),
          ],
        },
      ]);
    });
  });
});
