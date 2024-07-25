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

import { describe, it } from '@/tests/test-utils';
import assert from 'assert';
import { DEFAULT_COLLECTION_NAME } from '@/tests/config';

describe('integration.data-api.collection.options', ({ db }) => {
  before(async () => {
    await db.dropCollection('test_db_collection_empty_opts');
  });

  after(async () => {
    await db.dropCollection('test_db_collection_empty_opts');
  });

  it('lists its own options', async () => {
    const coll = db.collection(DEFAULT_COLLECTION_NAME);
    const res = await coll.options();
    assert.deepStrictEqual(res, { vector: { dimension: 5, metric: 'cosine' } });
  });

  it('[LONG] lists its own empty options', async () => {
    const coll = await db.createCollection('test_db_collection_empty_opts');
    const res = await coll.options();
    assert.deepStrictEqual(res, {});
    await db.dropCollection('test_db_collection_empty_opts')
  });
});
