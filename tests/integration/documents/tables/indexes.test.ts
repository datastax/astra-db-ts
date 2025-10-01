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
import type { DataAPIType2TSType, CreateTableColumnDefinitions } from '@/src/db/index.js';
import type { Table, TableIndexDescriptor } from '@/src/documents/index.js';

parallel('integration.documents.tables.indexes', { drop: 'tables:after' }, ({ db }) => {
  interface TestIndexCreationOptions<Def extends CreateTableColumnDefinitions[string]> {
    testColumnType: Def,
    createIndex: (table: Table<{ col: DataAPIType2TSType<Def> }>, indexName: string, columnName: 'col', opts: { ifNotExists?: boolean }) => Promise<void>,
    testName: string,
    indexType: TableIndexDescriptor['indexType'],
  }

  let indexCreationTestIndex = 0;

  const testIndexCreation = <Def extends CreateTableColumnDefinitions[string]>(cfg: TestIndexCreationOptions<Def>) => {
    it(cfg.testName, async () => {
      const name = `create_index_table_test_${indexCreationTestIndex++}`;

      const table = await db.createTable<{ col: DataAPIType2TSType<Def> }>(name, {
        definition: {
          columns: {
            pkey: 'text',
            col: cfg.testColumnType,
          },
          primaryKey: 'pkey',
        },
      });

      const createIndexFn = (ifNotExists?: boolean) => cfg.createIndex(table, `${name}_index`, 'col', { ifNotExists });
      await createIndexFn();

      await assert.rejects(() => createIndexFn());
      await assert.doesNotReject((() => createIndexFn(true)));

      const indexes = await table.listIndexes();
      assert.strictEqual(indexes.length, 1);

      const indexNames = await table.listIndexes({ nameOnly: true });
      assert.strictEqual(indexes.length, 1);

      assert.strictEqual(indexes[0].name, `${name}_index`);
      assert.strictEqual(indexes[0].indexType, cfg.indexType);
      assert.strictEqual(typeof indexes[0].definition, 'object');
      assert.strictEqual(indexNames[0], `${name}_index`);

      await db.dropTableIndex(`${name}_index`);

      await assert.rejects(() => db.dropTableIndex(`${name}_index`));
      await assert.doesNotReject(() => db.dropTableIndex(`${name}_index`, { ifExists: true }));

      await table.drop();
    });
  };

  testIndexCreation({
    testName: 'should work when createIndex-ing a scalar',
    testColumnType: 'text',
    indexType: 'regular',
    async createIndex(table, indexName, colName, opts) {
      await table.createIndex(indexName, colName, {
        options: {
          caseSensitive: false,
          normalize: false,
          ascii: true,
        },
        ...opts,
      });
    },
  });

  testIndexCreation({
    testName: 'should work when createIndex-ing map entries',
    indexType: 'regular',
    testColumnType: {
      type: 'map',
      keyType: 'text',
      valueType: 'decimal',
    },
    async createIndex(table, indexName, colName, opts) {
      await table.createIndex(indexName, colName, opts);
    },
  });

  testIndexCreation({
    testName: 'should work when createIndex-ing map keys',
    indexType: 'regular',
    testColumnType: {
      type: 'map',
      keyType: 'text',
      valueType: 'blob',
    },
    async createIndex(table, indexName, colName, opts) {
      await table.createIndex(indexName, { [colName]: '$keys' }, opts);
    },
  });

  testIndexCreation({
    testName: 'should work when createIndex-ing map values',
    indexType: 'regular',
    testColumnType: {
      type: 'map',
      keyType: 'text',
      valueType: 'bigint',
    },
    async createIndex(table, indexName, colName, opts) {
      await table.createIndex(indexName, { [colName]: '$values' }, opts);
    },
  });

  testIndexCreation({
    testName: 'should work when createIndex-ing list values',
    indexType: 'regular',
    testColumnType: {
      type: 'list',
      valueType: 'inet',
    },
    async createIndex(table, indexName, colName, opts) {
      await table.createIndex(indexName, { [colName]: '$values' }, opts);
    },
  });

  testIndexCreation({
    testName: 'should work when createIndex-ing set values',
    indexType: 'regular',
    testColumnType: {
      type: 'set',
      valueType: 'timestamp',
    },
    async createIndex(table, indexName, colName, opts) {
      await table.createIndex(indexName, { [colName]: '$values' }, opts);
    },
  });

  testIndexCreation({
    testName: 'should work when createVectorIndex-ing',
    indexType: 'vector',
    testColumnType: {
      type: 'vector',
      dimension: 3,
    },
    async createIndex(table, indexName, colName, opts) {
      await table.createVectorIndex(indexName, colName, opts);
    },
  });

  testIndexCreation({
    testName: 'should work when createTextIndex-ing',
    indexType: 'text',
    testColumnType: 'text',
    async createIndex(table, indexName, colName, opts) {
      await table.createTextIndex(indexName, colName, opts);
    },
  });
});
