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
import { FindCursor, CursorAlreadyInitializedError } from '@/src/data-api';
import { DataApiHttpClient } from '@/src/api';

describe('unit.data-api.cursor tests', async () => {
  let httpClient: DataApiHttpClient;

  const add1 = (a: number) => a + 1;
  const mul2 = (a: number) => a * 2;

  describe('Cursor initialization', () => {
    it('should initialize an uninitialized Cursor', async () => {
      const cursor = new FindCursor<any>('', httpClient, {});
      assert.ok(cursor, 'Cursor should not be nullish');
      assert.strictEqual(cursor.closed, false, 'Cursor should not be closed');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor should not have buffered anything');
      assert.strictEqual(cursor['_state'], 0, 'Cursor is not set to the UNINITIALIZED state');
    });

    it('should contain the proper namespace', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      assert.strictEqual(cursor.namespace, 'test_keyspace', 'Cursor has bad namespace');
    });

    it('should contain the proper options', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, { _id: '1' }, {
        limit: 10,
        skip: 5,
        sort: { _id: 1 },
        projection: { _id: 0 },
        includeSimilarity: true,
      });
      const options = cursor['_options'];
      assert.strictEqual(options.limit, 10, 'Cursor has bad limit');
      assert.strictEqual(options.skip, 5, 'Cursor has bad skip');
      assert.deepStrictEqual(options.sort, { _id: 1 }, 'Cursor has bad sort');
      assert.deepStrictEqual(options.projection, { _id: 0 }, 'Cursor has bad projection');
      assert.strictEqual(options.includeSimilarity, true, 'Cursor has bad includeSimilarity');
      assert.deepStrictEqual(cursor['_filter'], { _id: '1' }, 'Cursor has bad filter');
      assert.strictEqual(cursor['_mapping'], undefined, 'Cursor has bad _mapping');
    });
  });

  describe('Cursor building', () => {
    it('Should set new filter', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      cursor.filter({ _id: '0' }).filter({ _id: '1' });
      assert.deepStrictEqual(cursor['_filter'], { _id: '1' }, 'Cursor did not set new filter');
    });

    it('Should fail setting filter if cursor is not uninitialized', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      await cursor.close();
      assert.throws(() => cursor.filter({ _id: '1' }), CursorAlreadyInitializedError);
    });

    it('Should set new sort', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      cursor.sort({ _id: -1 }).sort({ _id: 1 });
      assert.deepStrictEqual(cursor['_options'].sort, { _id: 1 }, 'Cursor did not set new sort');
    });

    it('Should fail setting sort if cursor is not uninitialized', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      await cursor.close();
      assert.throws(() => cursor.sort({ _id: 1 }), CursorAlreadyInitializedError);
    });

    it('Should set new limit', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      cursor.limit(5).limit(10);
      assert.strictEqual(cursor['_options'].limit, 10, 'Cursor did not set new limit');
    });

    it('Should fail setting limit if cursor is not uninitialized', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      await cursor.close();
      assert.throws(() => cursor.limit(10), CursorAlreadyInitializedError);
    });

    it('Should set new skip', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      cursor.skip(3).skip(5);
      assert.strictEqual(cursor['_options'].skip, 5, 'Cursor did not set new skip');
    });

    it('Should fail setting skip if cursor is not uninitialized', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      await cursor.close();
      assert.throws(() => cursor.skip(5), CursorAlreadyInitializedError);
    });

    it('Should set new projection', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      cursor.project({ _id: 1 }).project({ _id: 0 });
      assert.deepStrictEqual(cursor['_options'].projection, { _id: 0 }, 'Cursor did not set new projection');
    });

    it('Should fail setting projection if cursor is not uninitialized', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      await cursor.close();
      assert.throws(() => cursor.project({ _id: 0 }), CursorAlreadyInitializedError);
    });

    it('Should set new includeSimilarity', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      cursor.includeSimilarity(true);
      assert.strictEqual(cursor['_options'].includeSimilarity, true, 'Cursor did not set new includeSimilarity');
    });

    it('Should set new includeSimilarity to true by default', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      cursor.includeSimilarity();
      assert.strictEqual(cursor['_options'].includeSimilarity, true, 'Cursor did not set new includeSimilarity');
    });

    it('Should fail setting includeSimilarity if cursor is not uninitialized', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      await cursor.close();
      assert.throws(() => cursor.includeSimilarity(true), CursorAlreadyInitializedError);
    });

    it('Should set new mapping', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      cursor.map(add1);
      assert.strictEqual(cursor['_mapping'], add1, 'Cursor did not set new mapping');
    });

    it('Should chain new mapping', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      cursor.map(add1).map(mul2);
      assert.strictEqual(cursor['_mapping']!(3), mul2(add1(3)), 'Cursor did not chain new mapping');
    });

    it('Should fail setting mapping if cursor is not uninitialized', async () => {
      const cursor = new FindCursor<any>('test_keyspace', httpClient, {});
      await cursor.close();
      assert.throws(() => cursor.map(add1), CursorAlreadyInitializedError);
    });
  });
});
