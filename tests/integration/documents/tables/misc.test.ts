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

import { DataAPIResponseError, timestamp } from '@/src/documents';
import { it, parallel } from '@/tests/testlib';
import assert from 'assert';

parallel('integration.documents.tables.misc', ({ db, table }) => {
  it('DataAPIResponseError is thrown when doing data api operation on non-existent tables', async () => {
    const table = db.table('non_existent_collection');
    await assert.rejects(() => table.insertOne({ text: 'test' }), DataAPIResponseError);
  });

  it('handles timestamps properly', async () => {
    const ts1 = timestamp();
    await table.insertOne({ text: '123', int: 0, timestamp: ts1 });
    const row1 = await table.findOne({ text: '123' });
    assert.deepStrictEqual(row1?.timestamp, ts1);

    const ts2 = timestamp(new Date('2021-01-01'));
    await table.insertOne({ text: '123', int: 0, timestamp: ts2 });
    const row2 = await table.findOne({ text: '123' });
    assert.deepStrictEqual(row2?.timestamp, ts2);

    console.log(row1.timestamp, row2.timestamp);
  });
});
