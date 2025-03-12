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

import { it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';

parallel('integration.documents.tables.indexes', { drop: 'tables:after' }, ({ db }) => {
  it('should work when createIndex-ing', async () => {
    const table = await db.createTable('create_index_table', {
      definition: {
        columns: {
          pkey: 'text',
          val: 'text',
        },
        primaryKey: 'pkey',
      },
    });

    await table.createIndex('val_index', { val: '$value' }, {
      options: {
        caseSensitive: false,
      },
    });

    await assert.rejects(() => table.createIndex('val_index', 'val'));
    await assert.doesNotReject(() => table.createIndex('val_index', 'val', { ifNotExists: true }));

    const indexes = await db.command({ listIndexes: { options: { explain: true } } }, { table: table.name }).then((res) => res.status!.indexes);
    assert.strictEqual(indexes.length, 1);

    const index = indexes[0];
    assert.strictEqual(index.name, 'val_index');
    assert.strictEqual(index.definition.column, 'val');

    await db.dropTableIndex('val_index');

    await assert.rejects(() => db.dropTableIndex('val_index'));
    await assert.doesNotReject(() => db.dropTableIndex('val_index', { ifExists: true }));
  });

  it('should work when createVector-ing', async () => {
    const table = await db.createTable('create_vector_index_table', {
      definition: {
        columns: {
          pkey: 'text',
          vec: { type: 'vector', dimension: 3 },
        },
        primaryKey: 'pkey',
      },
    });

    await table.createVectorIndex('vec_index', 'vec');

    await assert.rejects(() => table.createVectorIndex('vec_index', 'vec'));
    await assert.doesNotReject(() => table.createVectorIndex('vec_index', 'vec', { ifNotExists: true }));

    const indexes = await db.command({ listIndexes: { options: { explain: true } } }, { table: table.name }).then((res) => res.status!.indexes);
    assert.strictEqual(indexes.length, 1);

    const index = indexes[0];
    assert.strictEqual(index.name, 'vec_index');
    assert.strictEqual(index.definition.column, 'vec');

    await db.dropTableIndex('vec_index');

    await assert.rejects(() => db.dropTableIndex('vec_index'));
    await assert.doesNotReject(() => db.dropTableIndex('vec_index', { ifExists: true }));
  });
});
