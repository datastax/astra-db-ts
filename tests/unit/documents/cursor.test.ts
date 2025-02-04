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
import { describe, it } from '@/tests/testlib';
import { FindCursor } from '@/src/documents';
import { $CustomInspect } from '@/src/lib/constants';

describe('unit.documents.cursors', ({ collection }) => {
  class TestCursor extends FindCursor<any> {}

  it('should initialize an uninitialized Cursor', () => {
    const cursor = new TestCursor(collection, null!, [{}, false]);
    assert.ok(cursor);
    assert.strictEqual(cursor.buffered(), 0);
    assert.strictEqual(cursor.consumed(), 0);
    assert.strictEqual(cursor.state, 'idle');
  });

  it('should return the parent in dataSource', () => {
    const cursor = new TestCursor(collection, null!, [{}, false]);
    assert.strictEqual(cursor.dataSource, collection);
  });

  it('should fail to set projection after mapping', () => {
    const cursor1 = new TestCursor(collection, null!, [{}, false]);
    const cursor2 = cursor1.map((x) => x);
    assert.doesNotThrow(() => cursor1.project({}));
    assert.throws(() => cursor2.project({}));
  });

  it('should fail to set includeSimilarity after mapping', () => {
    const cursor1 = new TestCursor(collection, null!, [{}, false]);
    const cursor2 = cursor1.map((x) => x);
    assert.doesNotThrow(() => cursor1.includeSimilarity());
    assert.throws(() => cursor2.includeSimilarity());
  });

  it('should fail to set projection if not idle', () => {
    const cursor = new TestCursor(collection, null!, [{}, false]);
    assert.doesNotThrow(() => cursor.project({}));
    cursor.close();
    assert.throws(() => cursor.project({}));
  });

  it('should fail to set includeSimilarity if not idle', () => {
    const cursor = new TestCursor(collection, null!, [{}, false]);
    assert.doesNotThrow(() => cursor.includeSimilarity());
    cursor.close();
    assert.throws(() => cursor.includeSimilarity());
  });

  it('should error if trying to set .includeSortVector() after starting cursor', () => {
    const cursor = collection.find({}).includeSortVector();
    cursor.close();
    assert.throws(() => cursor.includeSortVector(), { name: 'CursorError' });
  });

  it('should inspect properly', () => {
    const cursor = new TestCursor(collection, null!, [{}, false]);
    assert.strictEqual((cursor as any)[$CustomInspect](), 'FindCursor(source="default_keyspace.test_coll",state="idle",consumed=0,buffered=0)');
  });
});
