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
import { FindCursor, CursorIsStartedError } from '@/src/data-api';
import { DataAPIHttpClient } from '@/src/api';

describe('unit.data-api.cursor', () => {
  let httpClient: DataAPIHttpClient;

  const add1 = (a: number) => a + 1;
  const mul2 = (a: number) => a * 2;

  describe('Cursor initialization', () => {
    it('should initialize an uninitialized Cursor', () => {
      const cursor = new FindCursor<any>('', httpClient, {});
      assert.ok(cursor, 'Cursor should not be nullish');
      assert.strictEqual(cursor.closed, false, 'Cursor should not be closed');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor should not have buffered anything');
      assert.strictEqual(cursor['_state'], 0, 'Cursor is not set to the UNINITIALIZED state');
    });

    it('should contain the proper namespace', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      assert.strictEqual(cursor.namespace, 'default_keyspace', 'Cursor has bad namespace');
    });

    it('should contain the proper options', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, { _id: '1' }, {
        limit: 10,
        skip: 5,
        sort: { _id: 1 },
        projection: { _id: 0 },
        includeSimilarity: true,
        includeSortVector: true,
      });
      const options = cursor['_options'];
      assert.strictEqual(options.limit, 10, 'Cursor has bad limit');
      assert.strictEqual(options.skip, 5, 'Cursor has bad skip');
      assert.deepStrictEqual(options.sort, { _id: 1 }, 'Cursor has bad sort');
      assert.deepStrictEqual(options.projection, { _id: 0 }, 'Cursor has bad projection');
      assert.strictEqual(options.includeSimilarity, true, 'Cursor has bad includeSimilarity');
      assert.strictEqual(options.includeSortVector, true, 'Cursor has bad includeSortVector');
      assert.deepStrictEqual(cursor['_filter'], { _id: '1' }, 'Cursor has bad filter');
      assert.strictEqual(cursor['_mapping'], undefined, 'Cursor has bad _mapping');
    });
  });

  describe('Cursor building', () => {
    it('should set new filter', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.filter({ _id: '0' }).filter({ _id: '1' });
      assert.deepStrictEqual(cursor['_filter'], { _id: '1' }, 'Cursor did not set new filter');
    });

    it('should fail setting filter if cursor is not uninitialized', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.close();
      assert.throws(() => cursor.filter({ _id: '1' }), CursorIsStartedError);
    });

    it('should set new sort', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.sort({ _id: -1 }).sort({ _id: 1 });
      assert.deepStrictEqual(cursor['_options'].sort, { _id: 1 }, 'Cursor did not set new sort');
    });

    it('should fail setting sort if cursor is not uninitialized', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.close();
      assert.throws(() => cursor.sort({ _id: 1 }), CursorIsStartedError);
    });

    it('should set new limit', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.limit(5).limit(10);
      assert.strictEqual(cursor['_options'].limit, 10, 'Cursor did not set new limit');
    });

    it('should fail setting limit if cursor is not uninitialized', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.close();
      assert.throws(() => cursor.limit(10), CursorIsStartedError);
    });

    it('should set new skip', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.skip(3).skip(5);
      assert.strictEqual(cursor['_options'].skip, 5, 'Cursor did not set new skip');
    });

    it('should fail setting skip if cursor is not uninitialized', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.close();
      assert.throws(() => cursor.skip(5), CursorIsStartedError);
    });

    it('should set new projection', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.project({ _id: 1 }).project({ _id: 0 });
      assert.deepStrictEqual(cursor['_options'].projection, { _id: 0 }, 'Cursor did not set new projection');
    });

    it('should fail setting projection if cursor is not uninitialized', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.close();
      assert.throws(() => cursor.project({ _id: 0 }), CursorIsStartedError);
    });

    it('should set new includeSimilarity', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.includeSimilarity(true);
      assert.strictEqual(cursor['_options'].includeSimilarity, true, 'Cursor did not set new includeSimilarity');
    });

    it('should set new includeSimilarity to true by default', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.includeSimilarity();
      assert.strictEqual(cursor['_options'].includeSimilarity, true, 'Cursor did not set new includeSimilarity');
    });

    it('should fail setting includeSimilarity if cursor is not uninitialized', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.close();
      assert.throws(() => cursor.includeSimilarity(true), CursorIsStartedError);
    });

    it('should set new includeSortVector', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.includeSortVector(true);
      assert.strictEqual(cursor['_options'].includeSortVector, true, 'Cursor did not set new includeSortVector');
    });

    it('should set new includeSortVector to true by default', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.includeSortVector();
      assert.strictEqual(cursor['_options'].includeSortVector, true, 'Cursor did not set new includeSortVector');
    });

    it('should fail setting includeSortVector if cursor is not uninitialized', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.close();
      assert.throws(() => cursor.includeSortVector(true), CursorIsStartedError);
    });

    it('should set new mapping', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.map(add1);
      assert.strictEqual(cursor['_mapping'], add1, 'Cursor did not set new mapping');
    });

    it('should chain new mapping', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.map(add1).map(mul2);
      assert.strictEqual(cursor['_mapping']?.(3), mul2(add1(3)), 'Cursor did not chain new mapping');
    });

    it('should fail setting mapping if cursor is not uninitialized', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      cursor.close();
      assert.throws(() => cursor.map(add1), CursorIsStartedError);
    });
  });
});
