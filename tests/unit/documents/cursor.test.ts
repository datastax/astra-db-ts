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
import { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { FindCursor } from '@/src/documents';

describe('unit.documents.cursor', () => {
  let httpClient: DataAPIHttpClient;

  // const add1 = (a: number) => a + 1;

  describe('Cursor initialization', () => {
    it('should initialize an uninitialized Cursor', () => {
      const cursor = new FindCursor<any>('', httpClient, {});
      assert.ok(cursor);
      assert.strictEqual(cursor.buffered(), 0);
      assert.strictEqual(cursor.consumed(), 0);
    });

    it('should contain the proper keyspace', () => {
      const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
      assert.strictEqual(cursor.keyspace, 'default_keyspace');
    });
  });

  // describe('Cursor building', () => {
  //   it('should fail setting filter if cursor is not uninitialized', () => {
  //     const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
  //     cursor.close();
  //     assert.throws(() => cursor.filter({ _id: '1' }), CursorIsStartedError);
  //   });
  //
  //   it('should fail setting sort if cursor is not uninitialized', () => {
  //     const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
  //     cursor.close();
  //     assert.throws(() => cursor.sort({ _id: 1 }), CursorIsStartedError);
  //   });
  //
  //   it('should fail setting limit if cursor is not uninitialized', () => {
  //     const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
  //     cursor.close();
  //     assert.throws(() => cursor.limit(10), CursorIsStartedError);
  //   });
  //
  //   it('should fail setting skip if cursor is not uninitialized', () => {
  //     const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
  //     cursor.close();
  //     assert.throws(() => cursor.skip(5), CursorIsStartedError);
  //   });
  //
  //   it('should fail setting projection if cursor is not uninitialized', () => {
  //     const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
  //     cursor.close();
  //     assert.throws(() => cursor.project({ _id: 0 }), CursorIsStartedError);
  //   });
  //
  //   it('should fail setting includeSimilarity if cursor is not uninitialized', () => {
  //     const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
  //     cursor.close();
  //     assert.throws(() => cursor.includeSimilarity(true), CursorIsStartedError);
  //   });
  //
  //   it('should fail setting includeSortVector if cursor is not uninitialized', () => {
  //     const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
  //     cursor.close();
  //     assert.throws(() => cursor.includeSortVector(true), CursorIsStartedError);
  //   });
  //
  //   it('should fail setting mapping if cursor is not uninitialized', () => {
  //     const cursor = new FindCursor<any>('default_keyspace', httpClient, {});
  //     cursor.close();
  //     assert.throws(() => cursor.map(add1), CursorIsStartedError);
  //   });
  // });
});
