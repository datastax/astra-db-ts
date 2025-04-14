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

import { DataAPIResponseError } from '@/src/documents/index.js';
import { it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';

parallel('integration.documents.tables.misc', ({ db }) => {
  it('DataAPIResponseError is thrown when doing data api operation on non-existent tables', async () => {
    const table = db.table('non_existent_collection');
    await assert.rejects(() => table.insertOne({ text: 'test' }), DataAPIResponseError);
  });
});
