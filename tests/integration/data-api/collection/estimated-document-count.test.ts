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

import { Collection } from '@/src/data-api';
import { initTestObjects } from '@/tests/fixtures';
import assert from 'assert';

describe('integration.data-api.collection.estimated-document-count', () => {
  let collection: Collection;

  before(async function () {
    [, , collection] = await initTestObjects();
  });

  it('roughly works', async () => {
    const resp = await collection.estimatedDocumentCount();
    assert.ok(typeof <any>resp === 'number');
    assert.ok(resp >= 0);
  });
});
