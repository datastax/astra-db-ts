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

import { it, parallel } from '@/tests/testlib';
import assert from 'assert';

parallel('integration.documents.tables.delete-many', ({ table, table_ }) => {
  it('should deleteMany on a single column', async (key) => {
    await table.insertMany(Array.from({ length: 5 }, (_, i) => ({ text: key, int: i })));
    const deleteManyResp = await table.deleteMany({ text: key, int: 3 });
    assert.strictEqual(deleteManyResp, undefined);

    const found = await table.find({ text: key }).toArray();
    assert.strictEqual(found.length, 4);
    assert.deepStrictEqual(found.map((doc) => doc.int), [0, 1, 2, 4]);
  });

  it('should deleteMany with a range', async (key) => {
    await table.insertMany(Array.from({ length: 50 }, (_, i) => ({ text: key, int: i })));
    const deleteManyResp = await table.deleteMany({ text: key, int: { $lt: 25 } });
    assert.strictEqual(deleteManyResp, undefined);

    const found = await table.find({ text: key }).toArray();
    assert.strictEqual(found.length, 25);
    assert.deepStrictEqual(found.map((doc) => doc.int), Array.from({ length: 25 }, (_, i) => i + 25));
  });

  it('should delete all documents given an empty filter', async (key) => {
    await table_.insertMany(Array.from({ length: 100 }, (_, i) => ({ text: key, int: i })));
    await table_.deleteMany({});
    const found = await table_.find({}).toArray();
    assert.strictEqual(found.length, 0);
  });
});
