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

import { it, parallel } from '@/tests/testlib/index.js';
import type { CreateTableDefinition } from '@/src/db/index.js';
import assert from 'assert';
import type { DataAPIVector, SomeRow, Table } from '@/src/documents/index.js';

parallel('integration.documents.tables.alter', { drop: 'tables:after' }, ({ db }) => {
  interface TestTableAlterOptions<TSchema extends SomeRow> {
    tableDefinition: CreateTableDefinition,
    performAlter: (table: Table<TSchema>) => Promise<void>,
    undoAlter: (table: Table<TSchema>) => Promise<void>,
    testBeforeAlter: (table: Table<TSchema>) => Promise<void>,
    testAfterAlter: (table: Table<TSchema>) => Promise<void>,
    testName: string,
  }

  let tableAlterTestIndex = 0;

  const testTableAlter = <TSchema extends SomeRow>(cfg: TestTableAlterOptions<TSchema>) => {
    it(cfg.testName, async () => {
      const name = `create_index_table_test_${tableAlterTestIndex++}`;

      const table = await db.createTable<TSchema>(name, {
        definition: cfg.tableDefinition,
      });

      await cfg.testBeforeAlter(table);

      await cfg.performAlter(table);

      await new Promise((resolve) => setTimeout(resolve, 250)); // helps stop tests from occasionally failing

      await cfg.testAfterAlter(table);

      await cfg.undoAlter(table);

      await new Promise((resolve) => setTimeout(resolve, 250));

      await cfg.testBeforeAlter(table);

      await table.drop();
    });
  };

  testTableAlter<{ pkey: string, cars: string[] }>({
    testName: 'should add & drop columns',
    tableDefinition: {
      columns: {
        pkey: 'text',
      },
      primaryKey: 'pkey',
    },
    async performAlter(table) {
      await table.alter({
        operation: {
          add: { columns: { cars: { type: 'list', valueType: 'text' } } },
        },
      });
    },
    async undoAlter(table) {
      await table.alter({
        operation: {
          drop: { columns: ['cars'] },
        },
      });
    },
    async testBeforeAlter(table) {
      const definition = await table.definition();
      assert.ok(!('cars' in definition.columns));
    },
    async testAfterAlter(table) {
      const definition = await table.definition();
      assert.strictEqual(definition.columns.cars.type, 'list');
      assert.strictEqual(definition.columns.cars.valueType, 'text');
    },
  });

  testTableAlter<{ pkey: string, vector: DataAPIVector | string }>({
    testName: 'should add & drop vectorize',
    tableDefinition: {
      columns: {
        pkey: 'text',
        vector: {
          type: 'vector',
          dimension: 1024,
        },
      },
      primaryKey: 'pkey',
    },
    async performAlter(table) {
      await table.alter({
        operation: {
          addVectorize: { columns: { vector: { provider: 'openai', modelName: 'text-embedding-3-small' } } },
        },
      });
    },
    async undoAlter(table) {
      await table.alter({
        operation: {
          dropVectorize: { columns: ['vector'] },
        },
      });
    },
    async testBeforeAlter(table) {
      const definition = await table.definition();
      assert.strictEqual(definition.columns.vector.type, 'vector');
      assert.strictEqual(definition.columns.vector.service, undefined);
    },
    async testAfterAlter(table) {
      const definition = await table.definition();
      assert.strictEqual(definition.columns.vector.type, 'vector');
      assert.strictEqual(typeof definition.columns.vector.service, 'object');
    },
  });
});
