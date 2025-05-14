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

import { Cfg, it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';

parallel('integration.documents.collections.options', { drop: 'colls:after' }, ({ db }) => {
  it('lists its own options', async () => {
    const coll = db.collection(Cfg.DefaultCollectionName);
    const res = await coll.options();
    assert.ok(typeof res === 'object');
  });

  it('error is thrown when doing .options() on non-existent collections', async () => {
    const collection = db.collection('non_existent_collection');
    await assert.rejects(() => collection.options(), Error);
  });
});
