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
import type { CqlType2TSType, CreateTableColumnDefinitions } from '@/src/db/index.js';
import type { Table } from '@/src/documents/index.js';

parallel('integration.documents.tables.indexes', { drop: 'tables:after' }, ({ db }) => {
  const listIndexes = (tableName: string) => db.command({ listIndexes: { options: { explain: true } } }, { table: tableName }).then((res) => res.status!.indexes);

  interface TestIndexCreationOptions<Def extends CreateTableColumnDefinitions[string]> {
    testColumnType: Def,
    createIndex: (table: Table<{ col: CqlType2TSType<Def> }>, indexName: string, columnName: 'col', opts: { ifNotExists?: boolean }) => Promise<void>,
    testName: string,
  }

  let indexCreationTestIndex = 0;

  const testIndexCreation = <Def extends CreateTableColumnDefinitions[string]>(cfg: TestIndexCreationOptions<Def>) => {
    it(cfg.testName, async () => {
      const name = `create_index_table_test_${indexCreationTestIndex++}`;

      const table = await db.createTable<{ col: CqlType2TSType<Def> }>(name, {
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

      const indexes = await listIndexes(name);
      assert.strictEqual(indexes.length, 1);

      const index = indexes[0];
      assert.strictEqual(index.name, `${name}_index`);

      await db.dropTableIndex(`${name}_index`);

      await assert.rejects(() => db.dropTableIndex(`${name}_index`));
      await assert.doesNotReject(() => db.dropTableIndex(`${name}_index`, { ifExists: true }));

      await table.drop();
    });
  };

  testIndexCreation({
    testName: 'should work when createIndex-ing a scalar',
    testColumnType: 'text',
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
    testColumnType: {
      type: 'vector',
      dimension: 3,
    },
    async createIndex(table, indexName, colName, opts) {
      await table.createVectorIndex(indexName, colName, opts);
    },
  });

  // TODO
  // testIndexCreation({
  //   testName: 'should work when createTextIndex-ing',
  //   testColumnType: 'text',
  //   async createIndexFn(table, indexName, colName, opts) {
  //     await table.createTextIndex(indexName, colName, opts);
  //   },
  // });
});
