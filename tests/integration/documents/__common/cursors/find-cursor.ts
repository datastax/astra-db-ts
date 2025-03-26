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

import type { Collection, SomeDoc, SomeRow, Table } from '@/src/documents/index.js';
import { memoizeRequests } from '@/tests/testlib/utils.js';
import assert from 'assert';
import { describe, it, parallel } from '@/tests/testlib/index.js';

interface FindCursorTestConfig {
  for: 'tables' | 'colls';
  mkSource: () => Table<SomeRow> | Collection,
  mkSource_: () => Table<SomeRow> | Collection,
}

export const integrationTestFindCursor = (cfg: FindCursorTestConfig) => {
  describe('common', { truncate: `${cfg.for}:before` }, () => {
    const source = cfg.mkSource();
    const source_ = cfg.mkSource_();
    const memoizedSource = memoizeRequests(source); // for tests that don't depend on an up-to-date result from the server

    const textKey = cfg.for === 'tables' ? 'text' : '_id';

    const sortByText = (a: SomeDoc, b: SomeDoc) => parseInt(a[textKey]) - parseInt(b[textKey]);
    const sortByInt = (a: SomeDoc, b: SomeDoc) => a.int - b.int;

    const intToString = (doc: SomeDoc) => ({ int: `${doc.int}` });
    const textToNum = (doc: SomeDoc) => ({ text: parseInt(doc[textKey]) });

    const docs = <const>[{ [textKey]: '0', int: 0 }, { [textKey]: '1', int: 1 }, { [textKey]: '2', int: 2 }];
    const docs_ = Array.from({ length: 100 }, (_, i) => <const>{ [textKey]: (i < 10 ? '0' : '') + `${i}`, int: i });

    before(async () => {
      await source.insertMany(docs);
      await source_.insertMany(docs_, { ordered: true });
    });

    parallel('hasNext', () => {
      it('should return true if there are more documents, setting the buffer', async () => {
        const cursor = source.find({});
        assert.strictEqual(await cursor.hasNext(), true);
        assert.strictEqual(cursor.buffered(), 3);
      });

      it('should return true if there are more documents left in the buffer, without touching it', async () => {
        const cursor = source.find({});
        await cursor.next();
        assert.strictEqual(cursor.buffered(), 2);
        assert.strictEqual(await cursor.hasNext(), true);
        assert.strictEqual(cursor.buffered(), 2);
      });

      it('should return true if there are more documents, but in the next page', async () => {
        const cursor = source_.find({});
        assert.strictEqual(await cursor.hasNext(), true);
        assert.ok(cursor.buffered() > 0);
        const pageSize = cursor.buffered();
        cursor.consumeBuffer();
        assert.strictEqual(cursor.buffered(), 0);
        assert.strictEqual(await cursor.hasNext(), true);
        assert.strictEqual(cursor.buffered(), pageSize);
      });

      it('should return false if there are no more documents left to find', async () => {
        const cursor = source.find({});
        await cursor.toArray();
        assert.strictEqual(cursor.buffered(), 0);
        assert.strictEqual(await cursor.hasNext(), false);
      });

      it('should close the cursor if no more docs to find and its not already closed', async () => {
        const cursor = source.find({});

        for (const _ of docs) {
          await cursor.next();
        }

        assert.strictEqual(cursor.state, 'started');
        assert.strictEqual(await cursor.hasNext(), false);
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should not start the cursor if it is idle', async () => {
        const cursor = memoizedSource.find({});
        assert.strictEqual(cursor.state, 'idle');
        await cursor.hasNext();
        assert.strictEqual(cursor.state, 'idle');
      });

      it('should not increase the amount of consumed documents', async () => {
        const cursor = memoizedSource.find({});
        assert.strictEqual(cursor.consumed(), 0);
        await cursor.hasNext();
        assert.strictEqual(cursor.consumed(), 0);
      });
    });
  });
};
