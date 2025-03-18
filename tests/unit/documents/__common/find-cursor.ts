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

import assert from 'assert';
import { it } from '@/tests/testlib/index.js';
import type { Collection, CollectionFindCursor, SomeRow, Table, TableFindCursor } from '@/src/documents/index.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import { AbstractCursorTestConfig, unitTestAbstractCursor } from '@/tests/unit/documents/__common/abstract-cursor.js';

interface FindCursorTestConfig extends AbstractCursorTestConfig {
  parent: Table<SomeRow> | Collection,
  CursorImpl: typeof CollectionFindCursor | typeof TableFindCursor,
}

export const unitTestFindCursor = ({ CursorImpl, parent }: FindCursorTestConfig) => {
  unitTestAbstractCursor({ CursorImpl, parent });

  it('should initialize an uninitialized Cursor', () => {
    const cursor = new CursorImpl(parent, null!, [{}, false]);
    assert.ok(cursor);
    assert.strictEqual(cursor.buffered(), 0);
    assert.strictEqual(cursor.consumed(), 0);
    assert.strictEqual(cursor.state, 'idle');
  });

  it('should return the parent in dataSource', () => {
    const cursor = new CursorImpl(parent, null!, [{}, false]);
    assert.strictEqual(cursor.dataSource, parent);
  });

  it('should fail to set projection after mapping', () => {
    const cursor1 = new CursorImpl(parent, null!, [{}, false]);
    const cursor2 = cursor1.map((x) => x);
    assert.doesNotThrow(() => cursor1.project({}));
    assert.throws(() => cursor2.project({}));
  });

  it('should fail to set includeSimilarity after mapping', () => {
    const cursor1 = new CursorImpl(parent, null!, [{}, false]);
    const cursor2 = cursor1.map((x) => x);
    assert.doesNotThrow(() => cursor1.includeSimilarity());
    assert.throws(() => cursor2.includeSimilarity());
  });

  it('should fail to set projection if not idle', () => {
    const cursor = new CursorImpl(parent, null!, [{}, false]);
    assert.doesNotThrow(() => cursor.project({}));
    cursor.close();
    assert.throws(() => cursor.project({}));
  });

  it('should fail to set includeSimilarity if not idle', () => {
    const cursor = new CursorImpl(parent, null!, [{}, false]);
    assert.doesNotThrow(() => cursor.includeSimilarity());
    cursor.close();
    assert.throws(() => cursor.includeSimilarity());
  });

  it('should error if trying to set .includeSortVector() after starting cursor', () => {
    const cursor = new CursorImpl(parent, null!, [{}, false]).includeSortVector();
    cursor.close();
    assert.throws(() => cursor.includeSortVector(), { name: 'CursorError' });
  });

  it('should inspect properly', () => {
    const cursor = new CursorImpl(parent, null!, [{}, false]);
    assert.strictEqual((cursor as any)[$CustomInspect](), `${CursorImpl.name}(source="default_keyspace.test_coll",state="idle",consumed=0,buffered=0)`);
  });
};
