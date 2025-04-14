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
import { TableSerDes } from '@/src/documents/tables/ser-des/ser-des.js';
import stableStringify from 'safe-stable-stringify';
import fc from 'fast-check';
import { arbs } from '@/tests/testlib/arbitraries.js';

describe('unit.documents.tables.ser-des.mutate-in-place', () => {
  describe('mutateInPlace: true', () => {
    const serdes = new TableSerDes({ ...TableSerDes.cfg.empty, mutateInPlace: true });

    it('should mutate the input object in place when necessary', () => {
      fc.assert(
        fc.property(arbs.tableDefinitionAndRow({ requireOneOf: ['uuid', 'inet'] }), ([, row]) => { // forces usage of types which would cause the object to mutate
          const origStr = stableStringify(row);
          const [res] = serdes.serialize(row);
          const afterStr = stableStringify(row);
          const resStr = stableStringify(res);

          assert.notStrictEqual(origStr, afterStr);
          assert.strictEqual(afterStr, resStr);
        }),
      );
    });
  });

  describe('mutateInPlace: false', () => {
    const serdes = new TableSerDes({ ...TableSerDes.cfg.empty, mutateInPlace: false });

    it('should never mutate the input object in place', () => {
      fc.assert(
        fc.property(arbs.tableDefinitionAndRow({ requireOneOf: ['uuid', 'inet'] }), ([, row]) => { // forces usage of types which would cause the object to mutate
          const origStr = stableStringify(row);
          const [res] = serdes.serialize(row);
          const afterStr = stableStringify(row);
          const resStr = stableStringify(res);

          assert.strictEqual(origStr, afterStr);
          assert.notStrictEqual(afterStr, resStr);
        }),
      );
    });
  });
});
