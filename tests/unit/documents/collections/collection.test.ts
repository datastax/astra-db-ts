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

import { describe } from '@/tests/testlib/index.js';
import { Collection, CollectionFindAndRerankCursor, CollectionFindCursor } from '@/src/documents/index.js';
import { unitTestTableSlashColls } from '@/tests/unit/documents/__common/table-slash-coll.js';
import type { CollectionOptions } from '@/src/db/index.js';

describe('unit.documents.collections.collection', () => {
  unitTestTableSlashColls({
    className: 'Collection',
    mkTSlashC: (db, httpClient, name, rootOpts, tableOpts) => new Collection(db, httpClient, name, rootOpts, tableOpts as CollectionOptions),
    findCursorClass: CollectionFindCursor,
    rerankCursorClass: CollectionFindAndRerankCursor,
  });
});
