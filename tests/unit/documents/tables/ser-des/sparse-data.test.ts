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
import fc from 'fast-check';
import { arbs } from '@/tests/testlib/arbitraries.js';
import type { StrictCreateTableColumnDefinition } from '@/src/db/index.js';

describe('unit.documents.tables.ser-des.sparse-data', () => {
  describe('sparseData: true', () => {
    const serdes = new TableSerDes({ ...TableSerDes.cfg.empty, sparseData: true });

    it('should leave populated fields populated', () => {
      fc.assert(
        fc.property(arbs.tableDefinitionAndRow({ partialRow: true }), ([schema, row]) => {
          const [serializedRow] = serdes.serialize(row);

          const resp = serdes.deserialize(serializedRow, {
            status: { projectionSchema: schema },
          });

          assert.deepStrictEqual(resp, serializedRow);
        }),
      );
    });

    it('should not populate unpopulated fields', () => {
      fc.assert(
        fc.property(arbs.tableDefinitionAndRow(), ([schema]) => {
          const resp = serdes.deserialize({}, {
            status: { projectionSchema: schema },
          });
          assert.deepStrictEqual(resp, {});
        }),
      );
    });
  });

  describe('sparseData: false', () => {
    const serdes = new TableSerDes({ ...TableSerDes.cfg.empty, sparseData: false });

    it('should populate all fields', () => {
      const defaultForType = (def: StrictCreateTableColumnDefinition) => {
        switch (def.type) {
          case 'map':
            return new Map();
          case 'set':
            return new Set();
          case 'list':
            return [];
          default:
            return null;
        }
      };

      fc.assert(
        fc.property(arbs.tableDefinitionAndRow(), ([schema]) => {
          const resp = serdes.deserialize({}, {
            status: { projectionSchema: schema },
          });

          const expected = Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, defaultForType(v)]));

          assert.deepStrictEqual(resp, expected);
        }),
      );
    });
  });
});
