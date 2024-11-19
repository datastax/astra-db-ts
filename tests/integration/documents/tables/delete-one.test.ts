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

import { DataAPIResponseError } from '@/src/documents';
import { it, parallel } from '@/tests/testlib';
import assert from 'assert';

parallel('integration.documents.tables.delete-one', { truncate: 'colls:before' }, ({ table }) => {
  it('should error on sort being set', async (key) => {
    await assert.rejects(() => table.deleteOne({ text: key, int: 0 }, { sort: { int: 1 } }), DataAPIResponseError);
    await assert.rejects(() => table.deleteOne({ text: key, int: 0 }, { sort: { vector: [.1, .2, .3, .4, .5] } }), DataAPIResponseError);
  });

  it('should delete one document with various filters', async (key1, key2) => {
    await table.insertOne({ text: key1, int: 0 });
    await table.deleteOne({ text: key1, int: { $gt: 0 } });
    assert.deepStrictEqual((await table.findOne({ text: key1, int: 0 }))?.int, 0);

    await table.insertOne({ text: key2, int: 1 });
    await table.deleteOne({ text: key2, int: { $gt: 0 } });
    assert.deepStrictEqual(await table.findOne({ text: key2, int: 1 }), null);
  });

  it('should delete many documents with $ne', async (key) => {
    await table.insertMany(Array.from({ length: 10 }, (_, i) => ({ text: key, int: i })));
    await table.deleteOne({ text: key, int: { $ne: 5 } });

    for (let i = 0; i < 10; i++) {
      if (i === 5) {
        assert.deepStrictEqual(await table.findOne({ text: key, int: i }, { projection: { text: 1, int: 1 } }), { text: key, int: i });
      } else {
        assert.deepStrictEqual(await table.findOne({ text: key, int: i }), null);
      }
    }
  });
});
