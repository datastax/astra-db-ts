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

import type { Collection, FindCursor, SomeDoc, SomeRow, Table } from '@/src/documents/index.js';
import { CursorError, DataAPIVector } from '@/src/documents/index.js';
import { assertPromiseResolvesImmediately, memoizeRequests } from '@/tests/testlib/utils.js';
import assert from 'assert';
import { describe, it, parallel } from '@/tests/testlib/index.js';
import { arbs } from '@/tests/testlib/arbitraries.js';
import fc from 'fast-check';
import stableStringify from 'safe-stable-stringify';

interface FindCursorTestConfig {
  for: 'tables' | 'colls';
  mkSource: () => Table<SomeRow> | Collection,
  mkSource_: () => Table<SomeRow> | Collection,
}

export const integrationTestFindCursor = (cfg: FindCursorTestConfig) => {
  describe('common', { truncate: `${cfg.for}:before` }, () => {
    const source = cfg.mkSource();
    const source_ = cfg.mkSource_();
    const memoizedSource = memoizeRequests(cfg.mkSource()); // for tests that don't depend on an up-to-date result from the server
    const memoizedSource_ = memoizeRequests(cfg.mkSource_());

    const textKey = cfg.for === 'tables' ? 'text' : '_id';
    const vectorKey = cfg.for === 'tables' ? 'vector' : '$vector';

    const sortByText = (a: SomeDoc, b: SomeDoc) => parseInt(a[textKey]) - parseInt(b[textKey]);
    const sortByInt = (a: SomeDoc, b: SomeDoc) => a.int - b.int;

    const intToString = (doc: SomeDoc) => ({ int: `${doc.int}` });
    const textToNum = (doc: SomeDoc) => ({ [textKey]: parseInt(doc[textKey]) });

    const assertIteratorThrowsOnClosed = async (cb: (cursor: FindCursor<unknown>) => Promise<unknown>) => {
      const cursor = source.find({});
      cursor.close();

      await assert.rejects(async () => {
        await cb(cursor);
      }, (e) => {
        assert.ok(e instanceof CursorError);
        assert.strictEqual(e.message, 'Cannot iterate over a closed cursor');
        assert.strictEqual(e.state, 'closed');
        assert.strictEqual(e.cursor, cursor);
        return true;
      });
    };

    const docs = [{ [textKey]: '0', int: 0 }, { [textKey]: '1', int: 1 }, { [textKey]: '2', int: 2 }];
    const docs_ = Array.from({ length: 100 }, (_, i) => <const>{ [textKey]: (i < 10 ? '0' : '') + `${i}`, int: i });

    before(async () => {
      await source.insertMany(docs);
      await source_.insertMany(docs_, { ordered: true });
    });

    parallel('hasNext', () => {
      it('should return true if there are more documents, setting the buffer', async () => {
        const cursor = memoizedSource.find({});
        assert.strictEqual(cursor.buffered(), 0);
        assert.strictEqual(await cursor.hasNext(), true);
        assert.strictEqual(cursor.buffered(), 3);
      });

      it('should return true if there are more documents left in the buffer, without touching it', async () => {
        const cursor = memoizedSource.find({});
        await cursor.next();
        assert.strictEqual(cursor.buffered(), 2);
        assert.strictEqual(await cursor.hasNext(), true);
        assert.strictEqual(cursor.buffered(), 2);
      });

      it('should return true if there are more documents, but in the next page', async () => {
        const cursor = memoizedSource_.find({});
        assert.strictEqual(await cursor.hasNext(), true);
        assert.ok(cursor.buffered() > 0);
        const pageSize = cursor.consumeBuffer().length;
        assert.strictEqual(cursor.buffered(), 0);
        assert.strictEqual(await cursor.hasNext(), true);
        assert.strictEqual(cursor.buffered(), pageSize);
      });

      it('should return false if there are no more documents left to find', async () => {
        const cursor = memoizedSource.find({});
        await cursor.toArray();
        assert.strictEqual(cursor.buffered(), 0);
        assert.strictEqual(await cursor.hasNext(), false);
      });

      it('should close the cursor if no more docs to find and its not already closed', async () => {
        const cursor = memoizedSource.find({});

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

      it('should immediately resolve false if the cursor state is closed', async () => {
        const cursor = source.find({}); // only fair that we test this on a non-memoized cursor
        cursor.close();
        assert.strictEqual(cursor.state, 'closed');
        const hasNext = await assertPromiseResolvesImmediately(() => cursor.hasNext());
        assert.strictEqual(hasNext, false);
      });

      it('should not execute the cursor mapping when performing hasNext', async () => {
        let mapped = false;

        const cursor = memoizedSource.find({})
          .map((d) => {
            mapped = true;
            return d;
          });

        await cursor.hasNext();
        assert.strictEqual(mapped, false);
      });
    });

    parallel('next', () => {
      it('should return the next document in the cursor, consuming the buffer', async () => {
        const seenSet = new Set(docs.map((d) => stableStringify(d)));
        const cursor = memoizedSource.find({});

        assert.strictEqual(cursor.buffered(), 0);
        for (const _ of docs) {
          seenSet.delete(stableStringify(await cursor.next()));
          assert.strictEqual(cursor.buffered(), 3 - cursor.consumed());
        }
        assert.strictEqual(cursor.buffered(), 0);
        assert.strictEqual(seenSet.size, 0);
      });

      it('should return null if there are no more documents left to find', async () => {
        const cursor = memoizedSource.find({});
        await cursor.toArray();
        assert.strictEqual(await cursor.next(), null);
      });

      it('should return the next document, even if its in the next page', async () => {
        const cursor = memoizedSource_.find({});
        const docFromP1 = await cursor.next();
        assert.ok(docFromP1);
        assert.ok(cursor.buffered() > 0);
        const pageSize = cursor.consumeBuffer().length + 1;
        assert.strictEqual(cursor.buffered(), 0);
        const docFromP2 = await cursor.next();
        assert.ok(docFromP2);
        assert.strictEqual(cursor.buffered() + 1, pageSize);
        assert.notDeepStrictEqual(docFromP1, docFromP2);
      });

      it('should close the cursor if no more docs to find and its not already closed', async () => {
        const cursor = memoizedSource.find({});

        for (const _ of docs) {
          await cursor.next();
        }

        assert.strictEqual(cursor.state, 'started');
        assert.strictEqual(await cursor.next(), null);
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should start the cursor if it is idle', async () => {
        const cursor = memoizedSource.find({});
        assert.strictEqual(cursor.state, 'idle');
        await cursor.next();
        assert.strictEqual(cursor.state, 'started');
      });

      it('should increase the amount of consumed documents', async () => {
        const cursor = memoizedSource.find({});
        assert.strictEqual(cursor.consumed(), 0);
        await cursor.next();
        assert.strictEqual(cursor.consumed(), 1);
      });

      it('should immediately resolve null if the cursor state is closed', async () => {
        const cursor = source.find({}); // only fair that we test this on a non-memoized cursor
        cursor.close();
        assert.strictEqual(cursor.state, 'closed');
        const next = await assertPromiseResolvesImmediately(() => cursor.next());
        assert.strictEqual(next, null);
      });

      it('should execute the cursor mapping when performing next', async () => {
        const res = arbs.one(fc.anything());
        const cursor = memoizedSource.find({}).map(() => res);
        assert.strictEqual(await cursor.next(), res);
      });
    });

    parallel('[Symbol.asyncIterator]', () => {
      it('should iterate over all documents', async () => {
        const cursor = memoizedSource_.find({});
        const seenSet = new Set(docs_.map((d) => stableStringify(d)));

        for await (const doc of cursor) {
          seenSet.delete(stableStringify(doc));
        }

        assert.strictEqual(seenSet.size, 0);
        assert.strictEqual(cursor.consumed(), docs_.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should iterate over all documents with a mapping function', async () => {
        const cursor = memoizedSource_.find({}).map((d) => stableStringify(d));
        const seenSet = new Set(docs_.map((d) => stableStringify(d)));

        for await (const doc of cursor) {
          seenSet.delete(doc);
        }

        assert.strictEqual(seenSet.size, 0);
        assert.strictEqual(cursor.consumed(), docs_.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should not iterate over anything if no documents found', async () => {
        const cursor = memoizedSource.find({ [textKey]: 'Shallow Green' });
        let i = 0;

        for await (const _ of cursor) {
          i++;
        }

        assert.strictEqual(i, 0);
        assert.strictEqual(cursor.consumed(), 0);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should close the cursor once done iterating', async () => {
        const cursor = memoizedSource.find({});
        for await (const _ of cursor) {
          // do nothing
        }
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should close the cursor if interrupted by break', async () => {
        const cursor = memoizedSource.find({});
        let i = 0;
        for await (const _ of cursor) {
          if (i++ === 1) break;
        }
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should close the cursor if an exception is thrown', async () => {
        const cursor = memoizedSource.find({});

        await assert.rejects(async () => {
          let i = 0;
          for await (const _ of cursor) {
            if (i++ === 1) throw new Error('oops');
          }
        }, {
          message: 'oops',
        });

        assert.strictEqual(cursor.state, 'closed');
      });

      it('should throw when attempting to iterate over a closed cursor', async () => {
        await assertIteratorThrowsOnClosed(async (cursor) => {
          for await (const _ of cursor) { /* do nothing */ }
        });
      });
    });

    parallel('toArray', () => {
      it('should get all documents', async () => {
        const cursor = memoizedSource_.find({});
        const docs = await cursor.toArray();
        assert.deepStrictEqual(docs.sort(sortByText), docs_);
        assert.strictEqual(cursor.consumed(), docs_.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should get all documents with a mapping function', async () => {
        const cursor = memoizedSource_.find({}).map(intToString);
        const docs = await cursor.toArray();
        assert.deepStrictEqual(docs.sort(sortByInt), docs_.map(intToString));
        assert.strictEqual(cursor.consumed(), docs_.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should return an empty array if no documents found', async () => {
        const cursor = memoizedSource.find({ [textKey]: 'Purple Night' });
        assert.deepStrictEqual(await cursor.toArray(), []);
        assert.strictEqual(cursor.consumed(), 0);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should close the cursor once done fetching all docs', async () => {
        const cursor = memoizedSource.find({});
        await cursor.toArray();
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should throw when attempting to iterate over a closed cursor', async () => {
        await assertIteratorThrowsOnClosed((cursor) => cursor.toArray());
      });
    });

    parallel('forEach', () => {
      it('should iterate over all documents', async () => {
        const cursor = memoizedSource_.find({});
        const seenSet = new Set<unknown>(docs_.map((d) => stableStringify(d)));

        await cursor.forEach((doc) => {
          seenSet.delete(stableStringify(doc));
        });

        assert.strictEqual(seenSet.size, 0);
        assert.strictEqual(cursor.consumed(), docs_.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should iterate over all documents with a mapping function', async () => {
        const cursor = memoizedSource_.find({}).map((d) => stableStringify(d));
        const seenSet = new Set<unknown>(docs_.map((d) => stableStringify(d)));

        await cursor.forEach((doc) => {
          seenSet.delete(doc);
        });

        assert.strictEqual(seenSet.size, 0);
        assert.strictEqual(cursor.consumed(), docs_.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should not iterate over anything if no documents found', async () => {
        const cursor = memoizedSource.find({ [textKey]: 'Shallow Green' });
        let i = 0;

        await cursor.forEach(() => {
          i++;
        });

        assert.strictEqual(i, 0);
        assert.strictEqual(cursor.consumed(), 0);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should close the cursor once done iterating', async () => {
        const cursor = memoizedSource.find({});
        await cursor.forEach(() => {});
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should close the cursor if interrupted by returning false', async () => {
        const cursor = memoizedSource.find({});
        await cursor.forEach(() => {
          return false;
        });
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should close the cursor if interrupted by returning Promise<false>', async () => {
        const cursor = memoizedSource.find({});
        await cursor.forEach(() => {
          return Promise.resolve(false);
        });
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should close the cursor if an exception is thrown', async () => {
        const cursor = memoizedSource.find({});

        await assert.rejects(async () => {
          await cursor.forEach(() => {
            throw new Error('oops');
          });
        }, {
          message: 'oops',
        });

        assert.strictEqual(cursor.state, 'closed');
      });

      it('should throw when attempting to iterate over a closed cursor', async () => {
        await assertIteratorThrowsOnClosed(async (cursor) => {
          await cursor.forEach(() => {});
        });
      });
    });

    parallel('filter tests', () => {
      it('should filter documents', async () => {
        const cursor = memoizedSource.find({}).filter({ [textKey]: '1' });
        const res = await cursor.toArray();
        assert.deepStrictEqual(res, [docs[1]]);
      });

      it('should filter documents with a mapping function', async () => {
        const cursor = memoizedSource.find({}).filter({ [textKey]: '1' }).map(intToString);
        const res = await cursor.toArray();
        assert.deepStrictEqual(res, [intToString(docs[1])]);
      });
    });

    parallel('skip/limit tests', () => {
      it('should limit documents', async () => {
        const cursor = memoizedSource.find({}).limit(2);
        const res = await cursor.toArray();
        assert.deepStrictEqual(res.length, 2);
      });

      it('should limit documents across pints', async () => {
        const cursor = memoizedSource_.find({}).limit(50);
        const res = await cursor.toArray();
        assert.strictEqual(res.length, 50);
      });

      it('should have no limit if limit is set to 0', async () => {
        const cursor = memoizedSource_.find({}).limit(0);
        const res = await cursor.toArray();
        assert.strictEqual(res.length, docs_.length);
      });

      it('should skip documents', async () => {
        const cursor = memoizedSource.find({}).skip(1).sort({ [textKey]: 1 });
        const res = await cursor.toArray();
        assert.deepStrictEqual(res.sort(sortByText), docs.slice(1));
      });

      it('should skip documents across pints', async () => {
        const cursor = memoizedSource_.find({}).skip(50).sort({ [textKey]: 1 });
        const res = await cursor.toArray();
        assert.deepStrictEqual(res, docs_.slice(50, 70));
      });

      it('should limit and skip documents across pints', async () => {
        const cursor = memoizedSource_.find({}).skip(50).limit(20).sort({ [textKey]: 1 });
        const res = await cursor.toArray();
        assert.deepStrictEqual(res, docs_.slice(50, 70));
      });
    });

    parallel('sort tests', () => {
      it('should sort documents', async () => {
        const cursor = memoizedSource_.find({}).sort({ [textKey]: 1 });
        const res = await cursor.toArray();
        assert.deepStrictEqual(res, [...docs_].slice(0, 20).sort(sortByText));
      });

      it('should sort documents with a mapping function', async () => {
        const cursor = memoizedSource.find({}).sort({ [textKey]: 1 }).map(textToNum);
        const res = await cursor.toArray();
        assert.deepStrictEqual(res, [...docs].sort(sortByText).map(textToNum));
      });

      it('should only return one page of docs with a sort', async () => {
        const cursor = memoizedSource_.find({}).sort({ [textKey]: 1 });
        assert.deepStrictEqual(await cursor.next(), docs_[0]);
        assert.ok(cursor.buffered() > 0);
        cursor.consumeBuffer();
        assert.strictEqual(await cursor.next(), null);
        assert.strictEqual(cursor.buffered(), 0);
      });
    });

    parallel('projection tests', () => {
      it('should project documents', async () => {
        const cursor = memoizedSource.find({}).project({ int: 0 }).sort({ [textKey]: 1 });
        const res = await cursor.toArray();
        assert.deepStrictEqual(res, [{ [textKey]: '0' }, { [textKey]: '1' }, { [textKey]: '2' }]);
      });

      it('should project documents with a mapping function', async () => {
        const cursor = memoizedSource.find({}).project({ [textKey]: 1 }).map(textToNum).sort({ [textKey]: 1 });
        const res = await cursor.toArray();
        assert.deepStrictEqual(res, [{ [textKey]: 0 }, { [textKey]: 1 }, { [textKey]: 2 }]);
      });
    });

    parallel('mapping tests', () => {
      it('should map documents', async () => {
        const cursor = memoizedSource.find({}).map(intToString);
        const res = await cursor.toArray();
        assert.deepStrictEqual(new Set(res), new Set([{ int: '0' }, { int: '1' }, { int: '2' }]));
      });

      it('should close cursor and rethrow error if mapping function throws', async () => {
        const cursor = memoizedSource.find({}).map(() => { throw new Error('Mapping error'); });
        await assert.rejects(async () => await cursor.toArray(), { message: 'Mapping error' });
        assert.equal(cursor.state, 'closed');
      });
    });

    parallel('sort vector tests', () => {
      before(async () => {
        await source.insertMany(Array.from({ length: 3 }, (_, i) => <const>{ [textKey]: `vector${i}`, int: i, [vectorKey]: new DataAPIVector([1, 1, 1, 1, 1]) }));
      });

      after(async () => {
        await Promise.all(Array.from({ length: 3 }, (_, i) => source.deleteOne({ [textKey]: `vector${i}`, int: i })));
      });

      it('should return sort vector on only first API call if includeSortVector: true', async () => {
        const cursor = source.find({}).sort({ [vectorKey]: [1, 1, 1, 1, 1] }).includeSortVector();

        const start = performance.now();
        assert.deepStrictEqual((await cursor.getSortVector())?.asArray(), [1, 1, 1, 1, 1]);
        assert.ok(performance.now() - start > 5);

        const cachedVector = await assertPromiseResolvesImmediately(() => cursor.getSortVector());
        assert.deepStrictEqual(cachedVector?.asArray(), [1, 1, 1, 1, 1]);
      });

      it('getSortVector should populate buffer if called first w/ includeSortVector: true', async () => {
        const cursor = source.find({}).sort({ [vectorKey]: [1, 1, 1, 1, 1] }).includeSortVector();
        assert.deepStrictEqual((await cursor.getSortVector())?.asArray(), [1, 1, 1, 1, 1]);
        assert.strictEqual(cursor.consumeBuffer().length, 3);
      });

      it('should return null in getSortVector if includeSortVector: false', async () => {
        const cursor = source.find({}).sort({ [vectorKey]: [1, 1, 1, 1, 1] });
        await cursor.hasNext();
        assert.deepStrictEqual(await cursor.getSortVector(), null);
      });

      it('should return null in getSortVector if no sort vector', async () => {
        const cursor = source_.find({}).includeSortVector();
        await cursor.hasNext();
        assert.strictEqual(await cursor.getSortVector(), null);
      });
    });

    parallel('lifecycle tests', () => {
      it('should allow rewound cursor to re-fetch all data', async () => {
        const cursor = source.find({}).map(intToString);
        const res = await cursor.toArray();
        assert.deepStrictEqual(res.sort(sortByInt), docs.map(intToString));
        assert.deepStrictEqual(cursor.buffered(), 0);

        cursor.rewind();
        const res2 = await cursor.toArray();
        assert.deepStrictEqual(res2.sort(sortByInt), docs.map(intToString));
        assert.deepStrictEqual(cursor.buffered(), 0);
      });

      it('should allow cloned cursor to re-fetch all data', async () => {
        const cursor = source.find({}).map(intToString);
        const res = await cursor.toArray();
        assert.deepStrictEqual(res.sort(sortByInt), docs.map(intToString));
        assert.deepStrictEqual(cursor.buffered(), 0);

        const clone = cursor.clone();
        const res2 = await clone.toArray();
        assert.deepStrictEqual(res2.sort(sortByInt), docs.map(intToString));
        assert.deepStrictEqual(cursor.buffered(), 0);
      });
    });

    parallel('misc', () => {
      it('should close cursor and rethrow error if getting documents throws', async () => {
        const source = cfg.mkSource();
        source._httpClient.executeCommand = () => { throw new Error('failing_client'); };
        const cursor = source.find({});
        await assert.rejects(async () => await cursor.toArray(), { message: 'failing_client' });
        assert.equal(cursor.state, 'closed');
      });
    });
  });
};
