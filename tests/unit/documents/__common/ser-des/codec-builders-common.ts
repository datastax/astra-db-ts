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

import type { CollectionCodecs, TableCodecs } from '@/src/documents/index.js';
import { $DeserializeForCollection } from '@/src/documents/index.js';
import { it } from '@/tests/testlib/index.js';
import assert from 'assert';
import type { RawCodec } from '@/src/lib/index.js';
import fc from 'fast-check';

export interface CodecBuilderCommonTestsConfig {
  CodecsClass: typeof CollectionCodecs | typeof TableCodecs,
  $DesSym: symbol,
  mkRawCodecs: (clazz: any) => readonly RawCodec[];
}

export const unitTestCodecBuilderCommon = ({ $DesSym, CodecsClass, ...cfg }: CodecBuilderCommonTestsConfig) => {
  it('should throw an error if optsOrClass is a class without a static $DesSym method', () => {
    const $DesSymName = ($DesSym as unknown === $DeserializeForCollection)
      ? '$DeserializeForCollection'
      : '$DeserializeForTable';

    assert.throws(() => CodecsClass.forName('', class {} as any), {
      message: [
        `Invalid codec class: '' - missing .[${$DesSymName}]`,
        '',
        `Did you forget to define [${$DesSymName}] on the class?`,
        '',
        "Don't do this:",
        `> class Bad { [${$DesSymName}] = () => ...; }`,
        '',
        'Do this:',
        `> class Good { [${$DesSymName}]() { ... } }`,
        '',
        'Or this:',
        `> Good[${$DesSymName}] = () => ...;`,
      ].join('\n'),
    });
  });

  it('should not error if optsOrClass is a class without a $SerSym method', () => {
    assert.doesNotThrow(() => CodecsClass.forName('', class { static [$DesSym]() {} } as any));
  });

  it('should convert class into opts: { deserialize: [$DesSym] }', () => {
    fc.assert(
      fc.property(fc.anything(), (anything) => {
        // @ts-expect-error - ts being stupid
        const clazz = class { static [$DesSym] = anything; };
        const codecs = cfg.mkRawCodecs(clazz);
        assert.strictEqual(codecs.length, 1);
        assert.deepStrictEqual(codecs[0].opts, { deserialize: clazz[$DesSym] });
      }),
    );
  });
};
