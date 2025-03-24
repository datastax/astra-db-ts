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
import { $SerializeForCollection } from '@/src/documents/index.js';
import { it } from '@/tests/testlib/index.js';
import type { TableSerDes } from '@/src/documents/tables/ser-des/ser-des.js';
import assert from 'assert';
import type { BaseSerCtx } from '@/src/lib/index.js';
import type { CollSerDes } from '@/src/documents/collections/ser-des/ser-des.js';
import fc from 'fast-check';
import type { StrictCreateTableColumnDefinition } from '@/src/db/index.js';

export interface AsCodecClassTestsConfig {
  CodecsClass: typeof CollectionCodecs | typeof TableCodecs,
  SerDesClass: typeof CollSerDes | typeof TableSerDes,
  datatypesArb: () => fc.Arbitrary<[unknown, unknown, StrictCreateTableColumnDefinition?]>,
  $SerSym: symbol,
  $DesSym: symbol,
}

export const unitTestAsCodecClass = ({ $SerSym, $DesSym, CodecsClass, SerDesClass, ...cfg }: AsCodecClassTestsConfig) => {
  const [$SerSymName, $DesSymName] = ($SerSym as unknown === $SerializeForCollection)
    ? ['$SerializeForCollection', '$DeserializeForCollection']
    : ['$SerializeForTable', '$DeserializeForTable'];

  it('should function as a way to sneak ser/des implementations onto an existing class', () => {
    class Unsuspecting<T> {
      constructor(public readonly value: T) {}
    }

    (Unsuspecting.prototype as any)[$SerSym] = function (ctx: BaseSerCtx<unknown>) {
      return ctx.replace(this.value);
    };

    (Unsuspecting as any)[$DesSym] = function (_: string, ctx: BaseSerCtx<unknown>) {
      return ctx.mapAfter((v) => new Unsuspecting(v));
    };

    const UnsuspectingCodecClass = CodecsClass.asCodecClass(Unsuspecting);
    const UnsuspectingCodec = CodecsClass.forName('unsuspecting', UnsuspectingCodecClass);

    const serdes = new SerDesClass({ ...SerDesClass.cfg.empty, codecs: [UnsuspectingCodec] } as any);

    fc.assert(
      fc.property(cfg.datatypesArb(), ([expectDes, expectSer, tableColumnDef]) => {
        const unsuspecting = new Unsuspecting(expectDes);

        const [actualSer] = serdes.serialize({ unsuspecting });
        assert.deepStrictEqual(actualSer, { unsuspecting: expectSer });

        const actualDes = serdes.deserialize(actualSer, { status: { projectionSchema: { unsuspecting: tableColumnDef } } });

        assert.deepStrictEqual(actualDes, { unsuspecting });
      }),
    );
  });

  it('should accept a builder function to easily build implementations without typing as any', () => {
    class Unsuspecting<T> {
      constructor(public readonly value: T) {}
    }

    const UnsuspectingCodecClass = CodecsClass.asCodecClass(Unsuspecting, {
      serializeForTable(ctx) {
        return ctx.replace(this.value);
      },
      deserializeForTable(_, ctx) {
        return ctx.mapAfter((v) => new Unsuspecting(v));
      },
      serializeForCollection(ctx) {
        return ctx.replace(this.value);
      },
      deserializeForCollection(_, ctx) {
        return ctx.mapAfter((v) => new Unsuspecting(v));
      },
    });

    const UnsuspectingCodec = CodecsClass.forName('unsuspecting', UnsuspectingCodecClass);

    const serdes = new SerDesClass({ ...SerDesClass.cfg.empty, codecs: [UnsuspectingCodec] } as any);

    fc.assert(
      fc.property(cfg.datatypesArb(), ([expectDes, expectSer, tableColumnDef]) => {
        const unsuspecting = new Unsuspecting(expectDes);

        const [actualSer] = serdes.serialize({ unsuspecting });
        assert.deepStrictEqual(actualSer, { unsuspecting: expectSer });

        const actualDes = serdes.deserialize(actualSer, { status: { projectionSchema: { unsuspecting: tableColumnDef } } });

        assert.deepStrictEqual(actualDes, { unsuspecting });
      }),
    );
  });

  it('should throw an error if the "clazz" has no prototype when trying to attach fns', () => {
    assert.throws(() => CodecsClass.asCodecClass(3 as any, {} as any), TypeError);
    assert.throws(() => CodecsClass.asCodecClass('3' as any, {} as any), TypeError);
    assert.throws(() => CodecsClass.asCodecClass(Object.create(null), {} as any), TypeError);
  });

  it('should throw an error if the "clazz" is not some function', () => {
    fc.assert(
      fc.property(fc.anything(), (clazz) => {
        fc.pre(typeof clazz !== 'function');
        assert.throws(() => CodecsClass.asCodecClass(clazz as any), TypeError);
      }),
    );
  });

  it('should throw an error if $SerSym is not on the class prototype', () => {
    class NoSer {
      // @ts-expect-error - ts being stupid
      static [$DesSym] = () => {};
    }
    assert.throws(() => CodecsClass.asCodecClass(NoSer), {
      message: [
        `Invalid codec class: 'NoSer' - missing NoSer.prototype.[${$SerSymName}]`,
        '',
        `Did you define [${$SerSymName}] as a class property instead of a prototype method?`,
        '',
        'Don\'t do this:',
        `> class Bad { [${$SerSymName}] = () => ...; }`,
        '',
        'Or this:',
        `> Bad[${$SerSymName}] = () => ...;`,
        '',
        'Do this:',
        `> class Good { [${$SerSymName}]() { ... } }`,
        '',
        'Or this:',
        `> Good.prototype[${$SerSymName}] = () => ...;`,
      ].join('\n'),
    });

    class SerNotOnProto {
      // @ts-expect-error - ts being stupid
      static [$DesSym] = () => {};
      // @ts-expect-error - ts being stupid
      [$SerSym] = () => {};
    }
    assert.throws(() => CodecsClass.asCodecClass(SerNotOnProto), {
      message: [
        `Invalid codec class: 'SerNotOnProto' - missing SerNotOnProto.prototype.[${$SerSymName}]`,
        '',
        `Did you define [${$SerSymName}] as a class property instead of a prototype method?`,
        '',
        'Don\'t do this:',
        `> class Bad { [${$SerSymName}] = () => ...; }`,
        '',
        'Or this:',
        `> Bad[${$SerSymName}] = () => ...;`,
        '',
        'Do this:',
        `> class Good { [${$SerSymName}]() { ... } }`,
        '',
        'Or this:',
        `> Good.prototype[${$SerSymName}] = () => ...;`,
      ].join('\n'),
    });
  });

  it('should throw an error if $DesSym is not on the class itself', () => {
    class NoDes {
      [$SerSym]() {}
    }
    assert.throws(() => CodecsClass.asCodecClass(NoDes), {
      message: [
        `Invalid codec class: 'NoDes' - missing NoDes.[${$DesSymName}]`,
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

    class DesNotOnClass {
      [$DesSym]() {};
      [$SerSym]() {}
    }
    assert.throws(() => CodecsClass.asCodecClass(DesNotOnClass), {
      message: [
        `Invalid codec class: 'DesNotOnClass' - missing DesNotOnClass.[${$DesSymName}]`,
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
};
