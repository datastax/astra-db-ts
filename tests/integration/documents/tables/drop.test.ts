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

import { Cfg, EverythingTableSchema, it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';

parallel('integration.documents.tables.drop', { drop: 'colls:after' }, ({ db }) => {
  it('(LONG) should drop a table using the table method', async () => {
    const table = await db.createTable('penguin_grass_three', { definition: EverythingTableSchema, keyspace: Cfg.OtherKeyspace });
    await table.drop();
    const tables = await db.listTables();
    const foundTable = tables.find(c => c.name === 'penguin_grass_three');
    assert.strictEqual(foundTable, undefined);
  });
});
