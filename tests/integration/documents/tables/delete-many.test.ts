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

import { describe, it } from '@/tests/testlib';
import assert from 'assert';

describe('integration.documents.tables.delete-many', { truncate: 'tables:before' }, ({ table, table_ }) => {
  before(async () => {
    await table.insertMany(Array.from({ length: 50 }, (_, i) => ({ text: '1', int: i })));
    await table_.insertMany(Array.from({ length: 100 }, (_, i) => ({ text: '1', int: i })));
  });

  it('should deleteMany on a single column', async () => {
    const deleteManyResp = await table.deleteMany({ text: '1', int: 0 });
    assert.strictEqual(deleteManyResp, undefined);

    const found = await table.find({}).toArray();
    assert.strictEqual(found.length, 49);
  });

  it('should deleteMany with a range', async () => {
    const deleteManyResp = await table.deleteMany({ text: '1', int: { $lt: 25 } });
    assert.strictEqual(deleteManyResp, undefined);

    const found = await table.find({}).toArray();
    assert.strictEqual(found.length, 25);
  });

  it('should delete all documents given an empty filter', async () => {
    await table_.deleteMany({});
    const found = await table_.find({}).toArray();
    assert.strictEqual(found.length, 0);
  });
});
