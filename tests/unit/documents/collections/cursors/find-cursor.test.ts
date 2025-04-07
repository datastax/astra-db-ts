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

import { describe } from '@/tests/testlib/index.js';
import { CollectionFindCursor } from '@/src/documents/index.js';
import { unitTestFindCursor } from '@/tests/unit/documents/__common/cursors/find-cursor.js';
import { CollSerDes } from '@/src/documents/collections/ser-des/ser-des.js';

describe('unit.documents.collections.cursors.find-cursor', ({ collection }) => {
  unitTestFindCursor({
    CursorImpl: CollectionFindCursor,
    parent: collection,
    serdes: new CollSerDes(CollSerDes.cfg.empty),
  });
});
