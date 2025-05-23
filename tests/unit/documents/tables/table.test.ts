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

import { describe, it } from '@/tests/testlib/index.js';
import assert from 'assert';
import { Table, TableFindAndRerankCursor, TableFindCursor } from '@/src/documents/index.js';
import fc from 'fast-check';
import { unitTestTableSlashColls } from '@/tests/unit/documents/__common/table-slash-coll.js';
import type { TableOptions } from '@/src/db/index.js';

describe('unit.documents.tables.table', () => {
  unitTestTableSlashColls({
    className: 'Table',
    mkTSlashC: (db, httpClient, name, rootOpts, tableOpts) => new Table(db, httpClient, name, rootOpts, tableOpts as TableOptions),
    findCursorClass: TableFindCursor,
    rerankCursorClass: TableFindAndRerankCursor,
  });

  describe('static', () => {
    describe('schema', () => {
      it('returns exactly what it was given', () => {
        fc.assert(
          fc.property(fc.anything(), (anything) => {
            assert.strictEqual(Table.schema(anything as any), anything);
          }),
        );
      });
    });
  });
});
