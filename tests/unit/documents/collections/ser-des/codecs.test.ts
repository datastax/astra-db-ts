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
import type { CollectionCodec} from '@/src/documents/index.js';
import { $DeserializeForCollection, $SerializeForCollection, CollectionCodecs } from '@/src/documents/index.js';
import type { RawCollCodecs } from '@/src/documents/collections/ser-des/codecs.js';
import { processCodecs } from '@/src/lib/api/ser-des/codecs.js';

describe('unit.documents.collections.ser-des.codecs', () => {
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

      // console.dir(processed, { depth: null });

      assert.deepStrictEqual(processed, [
        {
          forName: {
            ...Object.fromEntries(repeat((i) => [`name${i}`, [`name${i}:ser_fn`, `name${i}:serdes_fn`]])),
          },
          forPath: {
            ['3']: repeat((i) => ({ path: ['pa', 'th', `${i}`], fns: [`path${i}:ser_fn`, `path${i}:serdes_fn`] })),
          },
          forClass: [
            { class: Delegate, fns: [...repeat((i) => `type${i}:ser_fn/class`), ...repeat((i) => `custom${i}:ser_fn/class`)] },
          ],
          forGuard: [
            ...repeat((i) => ({ guard: `type${i}:ser_guard`, fn: `type${i}:ser_fn/guard` })),
            ...repeat((i) => ({ guard: `custom${i}:ser_guard`, fn: `custom${i}:ser_fn/guard` })),
          ],
        },
        {
          forName: {
            ...Object.fromEntries(repeat((i) => [`name${i}`, ['$DeserializeForCollection', `name${i}:des_fn`, `name${i}:serdes_fn`]])),
          },
          forPath: {
            ['3']: repeat((i) => ({ path: ['pa', 'th', `${i}`], fns: ['$DeserializeForCollection', `path${i}:des_fn`, `path${i}:serdes_fn`] })),
          },
          forType: {
            ...Object.fromEntries(repeat((i) => [`type${i}`, ['$DeserializeForCollection', `type${i}:des_fn`]])),
          },
          forGuard: [
            ...repeat((i) => ({ guard: `custom${i}:des_guard`, fn: `custom${i}:des_fn` })),
          ],
        },
      ]);
    });
  });
});
