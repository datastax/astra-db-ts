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

import { describe, it } from '@/tests/testlib';
import assert from 'assert';

describe('integration.documents.collections.delete-all', { truncateColls: 'default:before' }, ({ collection }) => {
  it('should deleteAll', async () => {
    const res = await collection.insertMany(Array.from({ length: 20 }, () => ({})));
    assert.strictEqual(res.insertedCount, 20);
    await collection.deleteAll();
    const numDocs = await collection.countDocuments({}, 1000);
    assert.strictEqual(numDocs, 0);
  });
});
