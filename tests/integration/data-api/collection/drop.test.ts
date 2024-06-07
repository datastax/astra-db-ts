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

import { Db } from '@/src/data-api';
import { assertTestsEnabled, EPHEMERAL_COLLECTION_NAME, initTestObjects } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.drop', () => {
  let db: Db;

  before(async function () {
    [, db] = await initTestObjects(this);
  });

  it('[long] drops itself', async function () {
    assertTestsEnabled(this, 'LONG');
    const collection = await db.createCollection(EPHEMERAL_COLLECTION_NAME);

    const res = await collection.drop();
    assert.strictEqual(res, true);

    const collections = await db.listCollections();
    assert.strictEqual(collections.map(c => c.name).includes(EPHEMERAL_COLLECTION_NAME), false);
  });
});
