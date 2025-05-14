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

parallel('integration.documents.collections.drop', { drop: 'colls:after' }, ({ db }) => {
  it('(LONG) should drop a collection using the collection method', async () => {
    const coll = await db.createCollection('purple_gassy_balloon', { keyspace: Cfg.OtherKeyspace, indexing: { deny: ['*'] } });
    await coll.drop();
    const collections = await db.listCollections();
    const foundColl = collections.find(c => c.name === 'purple_gassy_balloon');
    assert.strictEqual(foundColl, undefined);
  });
});
