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
import { $DeserializeForCollection, $SerializeForCollection, CollectionCodecs } from '@/src/documents/collections/index.js';
import type { CollectionCodec } from '@/src/index.js';
import { ctxNevermind } from '@/src/lib/api/ser-des/ctx.js';
import { CollSerDes } from '@/src/documents/collections/ser-des/ser-des.js';

describe('unit.documents.collections.ser-des.ser-des.order', () => {
  const counters = {
    ser: [] as string[],
    des: [] as string[],
  };

  const ser = (tag: string, i?: number) => () => {
    counters.ser.push(`${tag}${i ?? ''}`);
    return ctxNevermind();
  };

  const des = (tag: string, i?: number) => () => {
    counters.des.push(`${tag}${i ?? ''}`);
    return ctxNevermind();
  };

  class Test implements CollectionCodec<typeof Test> {
    [$SerializeForCollection] = ser('$SerializeForColl');
    static [$DeserializeForCollection] = des('$DeserializeForColl');
  }

  const repeat = <T>(mk: (n: number) => T) => Array.from({ length: 3 }, (_, i) => mk(i));

  it('should process all of the serialization codecs in the right order', () => {
    const serdes = new CollSerDes({
      ...CollSerDes.cfg.empty,
      codecs: [
        [
          repeat((i) => CollectionCodecs.forPath([], {
            serialize: ser('forPath:root', i),
          })),
        ],
        [
          repeat((i) => CollectionCodecs.forName('', {
            serialize: ser('forName:root', i),
          })),
        ],
        [
          repeat((i) => CollectionCodecs.forPath(['test'], {
            serialize: ser('forPath:test', i),
          })),
        ],
        [
          repeat((i) => CollectionCodecs.forName('test', {
            serialize: ser('forName:test', i),
          })),
        ],
        [
          repeat((i) => CollectionCodecs.custom({
            serializeGuard: () => true,
            serialize: ser('custom:guard_any', i),
          })),
          repeat((i) => CollectionCodecs.forType('int', {
            serializeGuard: () => true,
            serialize: ser('forType:guard_any', i),
          })),
          repeat((i) => CollectionCodecs.custom({
            serializeGuard: (v) => v instanceof Test,
            serialize: ser('custom:guard', i),
          })),
          repeat((i) => CollectionCodecs.forType('int', {
            serializeGuard: (v) => v instanceof Test,
            serialize: ser('forType:guard', i),
          })),
          repeat((i) => CollectionCodecs.custom({
            serializeGuard: (v) => v instanceof Test,
            serialize: ser('custom:guard', i),
          })),
        ],
        [
          repeat(() => CollectionCodecs.forType('int', Test)),
        ],
        [
          repeat((i) => CollectionCodecs.forType('int', {
            serializeClass: Test,
            serialize: ser('forType:class', i),
          })),
          repeat((i) => CollectionCodecs.custom({
            serializeClass: Test,
            serialize: ser('custom:class', i),
          })),
          repeat((i) => CollectionCodecs.forType('int', {
            serializeClass: Test,
            serialize: ser('forType:class', i),
          })),
        ],
      ].sort(() => .5 - Math.random()).flat(2),
    });

    const obj = { test: new Test() };
    serdes.serialize(obj);

    assert.deepStrictEqual(counters.ser, [
      // forPath always runs before forName
      repeat((i) => `forPath:root${i}`),
      repeat((i) => `forName:root${i}`),

      // Run custom guards now because nothing else matches
      repeat((i) => `custom:guard_any${i}`),
      repeat((i) => `forType:guard_any${i}`),

      // Run forPath and forName for the nested object
      repeat((i) => `forPath:test${i}`),
      repeat((i) => `forName:test${i}`),

      // All guards run now since they all match
      repeat((i) => `custom:guard_any${i}`),
      repeat((i) => `forType:guard_any${i}`),
      repeat((i) => `custom:guard${i}`),
      repeat((i) => `forType:guard${i}`),
      repeat((i) => `custom:guard${i}`),

      // Now delegate serialization occurs
      ['$SerializeForColl'],

      // Finally, class serializers run
      repeat((i) => `forType:class${i}`),
      repeat((i) => `custom:class${i}`),
      repeat((i) => `forType:class${i}`),
    ].flat());
  });

  it('should process all of the deserialization codecs in the right order', () => {
    const serdes = new CollSerDes({
      ...CollSerDes.cfg.empty,
      codecs: [
        [
          repeat((_) => CollectionCodecs.forPath([], Test)),
          repeat((i) => CollectionCodecs.forPath([], {
            deserialize: des('forPath:root', i),
          })),
          repeat((_) => CollectionCodecs.forPath([], Test)),
        ],
        [
          repeat((i) => CollectionCodecs.forName('', {
            deserialize: des('forName:root', i),
          })),
          repeat((_) => CollectionCodecs.forName('', Test)),
          repeat((i) => CollectionCodecs.forName('', {
            deserialize: des('forName:root', i),
          })),
        ],
        [
          repeat((_) => CollectionCodecs.forPath(['test'], Test)),
          repeat((i) => CollectionCodecs.forPath(['test'], {
            deserialize: des('forPath:test', i),
          })),
          repeat((_) => CollectionCodecs.forPath(['test'], Test)),
        ],
        [
          repeat((i) => CollectionCodecs.forName('test', {
            deserialize: des('forName:test', i),
          })),
          repeat((_) => CollectionCodecs.forName('test', Test)),
          repeat((i) => CollectionCodecs.forName('test', {
            deserialize: des('forName:test', i),
          })),
        ],
        [
          repeat((i) => CollectionCodecs.custom({
            deserializeGuard: () => true,
            deserialize: des('custom:guard_any', i),
          })),
          repeat((i) => CollectionCodecs.custom({
            deserializeGuard: (v) => !!v && typeof v === 'object' && 'test' in v,
            deserialize: des('custom:guard', i),
          })),
        ],
        [
          repeat((i) => CollectionCodecs.forType('test', {
            deserialize: des('forType', i),
          })),
        ],
      ].sort(() => .5 - Math.random()).flat(2),
    });

    const obj = { test: 3 };
    serdes.deserialize(obj, {});

    assert.deepStrictEqual(counters.des, [
      // forPath always runs before forName; forPath-delegate-deserialization happen alongside normal forPath-deserialization
      repeat((_) => '$DeserializeForColl'),
      repeat((i) => `forPath:root${i}`),
      repeat((_) => '$DeserializeForColl'),

      // forName runs after forPath; forName-delegate-deserialization happen alongside normal forName-deserialization
      repeat((i) => `forName:root${i}`),
      repeat((_) => '$DeserializeForColl'),
      repeat((i) => `forName:root${i}`),

      // Custom deserializers run next
      repeat((i) => `custom:guard_any${i}`),
      repeat((i) => `custom:guard${i}`),

      // Type deserializers after
      repeat((i) => `forType${i}`),

      // forPath in the nested object
      repeat((_) => '$DeserializeForColl'),
      repeat((i) => `forPath:test${i}`),
      repeat((_) => '$DeserializeForColl'),

      // forName in the nested object
      repeat((i) => `forName:test${i}`),
      repeat((_) => '$DeserializeForColl'),
      repeat((i) => `forName:test${i}`),

      // Only the first custom deserializer matches this time (type deserializer also doesn't match)
      repeat((i) => `custom:guard_any${i}`),
    ].flat());
  });
});
