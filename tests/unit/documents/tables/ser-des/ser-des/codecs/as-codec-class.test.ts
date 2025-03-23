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
import type { TableDesCtx} from '@/src/documents/tables/ser-des/ser-des.js';
import { type TableSerCtx, TableSerDes } from '@/src/documents/tables/ser-des/ser-des.js';
import { $DeserializeForTable, $SerializeForTable, TableCodecs } from '@/src/documents/index.js';
import assert from 'assert';

describe('unit.documents.tables.ser-des.ser-des.codecs-as-codec-class', () => {
  it('should function as a way to sneak ser/des implementations onto an existing class', () => {
    class Unsuspecting<T> {
      constructor(public readonly value: T) {}
    }

    (Unsuspecting.prototype as any)[$SerializeForTable] = function (ctx: TableSerCtx) {
      return ctx.replace(this.value);
    };

    (Unsuspecting as any)[$DeserializeForTable] = function (_: string, ctx: TableDesCtx) {
      return ctx.mapAfter((v) => new Unsuspecting(v));
    };

    const UnsuspectingCodecClass = TableCodecs.asCodecClass(Unsuspecting);
    const UnsuspectingCodec = TableCodecs.forName('unsuspecting', UnsuspectingCodecClass);

    const serdes = new TableSerDes({ ...TableSerDes.cfg.empty, codecs: [UnsuspectingCodec] });

    const unsuspecting = new Unsuspecting('hello');

    const [ser] = serdes.serialize({ unsuspecting });
    assert.deepStrictEqual(ser, { unsuspecting: 'hello' });

    const des = serdes.deserialize({ unsuspecting: 'hello' }, { status: { projectionSchema: { unsuspecting: { type: 'text' } } } });
    assert.deepStrictEqual(des, { unsuspecting });
  });
});
