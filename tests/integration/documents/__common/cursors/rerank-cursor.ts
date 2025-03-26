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

import type { Collection, FindAndRerankCursor, RerankResult, SomeDoc } from '@/src/documents/index.js';
import { CursorError } from '@/src/documents/index.js';
import { assertPromiseResolvesImmediately, memoizeRequests } from '@/tests/testlib/utils.js';
import assert from 'assert';
import { describe, it, parallel } from '@/tests/testlib/index.js';
import stableStringify from 'safe-stable-stringify';
import { arbs } from '@/tests/testlib/arbitraries.js';
import fc from 'fast-check';

interface FindCursorTestConfig {
  for: 'tables' | 'colls';
  mkSource: () => Collection,
  mkSource_: () => Collection,
}

export const integrationTestRerankCursor = (cfg: FindCursorTestConfig) => {
  describe('common', { truncate: `${cfg.for}:before` }, () => {
    const source = cfg.mkSource();
    const source_ = cfg.mkSource_();
    const memoizedSource = memoizeRequests(cfg.mkSource()); // for tests that don't depend on an up-to-date result from the server
    const memoizedSource_ = memoizeRequests(cfg.mkSource_());

    const textKey = cfg.for === 'tables' ? 'text' : '_id';
    const vectorKey = cfg.for === 'tables' ? 'vector' : '$vector';
    const lexicalKey = cfg.for === 'tables' ? '$iLikeCars123' : '$lexical';
    const vectorizeKey = cfg.for === 'tables' ? 'vector1' : '$vectorize';

    const sortByText = (a: SomeDoc, b: SomeDoc) => parseInt(a[textKey]) - parseInt(b[textKey]);
    const sortByInt = (a: SomeDoc, b: SomeDoc) => a.int - b.int;

    const intToString = (doc: SomeDoc) => ({ int: `${doc.int}` });
    const textToNum = (doc: SomeDoc) => ({ [textKey]: parseInt(doc[textKey]) });

    const assertIteratorThrowsOnClosed = async (cursor: FindAndRerankCursor<unknown>, cb: () => Promise<unknown>) => {
      cursor.close();

      await assert.rejects(async () => {
        await cb();
      }, (e) => {
        assert.ok(e instanceof CursorError);
        assert.strictEqual(e.message, 'Cannot iterate over a closed cursor');
        assert.strictEqual(e.state, 'closed');
        assert.strictEqual(e.cursor, cursor);
        return true;
      });
    };

    const docs = [
      { [textKey]: '0', int: 0, [vectorKey]: [.1, .1, .1, .1, .1], [lexicalKey]: 'I like cars' },
      { [textKey]: '1', int: 1, [vectorKey]: [.5, .3, .3, .4, .5], [lexicalKey]: 'I like bikes' },
      { [textKey]: '2', int: 2, [vectorKey]: [.1, .3, .5, .3, .1], [lexicalKey]: 'I like boats' },
    ];

    const docs_ = [
      { [textKey]: '0', int: 0, [vectorizeKey]: 'I like cars',  [lexicalKey]: 'I like cars' },
      { [textKey]: '1', int: 1, [vectorizeKey]: 'I like bikes', [lexicalKey]: 'I like bikes' },
      { [textKey]: '2', int: 2, [vectorizeKey]: 'I like boats', [lexicalKey]: 'I like boats' },
    ];

    const vectors = docs.map(doc => doc[vectorKey] as number[]);
    const strings = docs.map(doc => doc[lexicalKey] as string);

    before(async () => {
      await source.insertMany(docs);
      await source_.insertMany(docs_);
    });

    interface OverBYOAndVectorizeConfig<T = RerankResult<SomeDoc>> {
      name: string,
      sources?: [Collection, Collection],
      test: (cursor: FindAndRerankCursor<T>) => Promise<void>,
      modifyBYO?: (cursor: FindAndRerankCursor<SomeDoc>) => FindAndRerankCursor<T>,
      modifyVectorize?: (cursor: FindAndRerankCursor<SomeDoc>) => FindAndRerankCursor<T>,
    }

    const overBYOAndVectorize = (cfg: OverBYOAndVectorizeConfig) => {
      it(`${cfg.name} (byo-vector)`, async () => {
        const byoCursor = (cfg.sources?.[0] ?? memoizedSource).findAndRerank({})
          .sort({ $hybrid: { [vectorKey]: vectors[0], [lexicalKey]: strings[0] } })
          .rerankOn(lexicalKey)
          .rerankQuery('I like cars');

        await cfg.test(cfg.modifyBYO?.(byoCursor) ?? byoCursor as any);
      });

      it(`${cfg.name} (vectorize)`, async () => {
        const vectorizeCursor = (cfg.sources?.[1] ?? memoizedSource_).findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        await cfg.test(cfg.modifyVectorize?.(vectorizeCursor) ?? vectorizeCursor as any);
      });
    };

    parallel('hasNext', () => {
      overBYOAndVectorize({
        name: 'should return true if there are more documents, setting the buffer',
        test: async (cursor) => {
          assert.strictEqual(cursor.buffered(), 0);
          assert.strictEqual(await cursor.hasNext(), true);
          assert.strictEqual(cursor.buffered(), 3);
        },
      });

      overBYOAndVectorize({
        name: 'should return false if there are no more documents left to find',
        test: async (cursor) => {
          await cursor.toArray();
          assert.strictEqual(cursor.buffered(), 0);
          assert.strictEqual(await cursor.hasNext(), false);
        },
      });

      overBYOAndVectorize({
        name: 'should close the cursor if no more docs to find and its not already closed',
        test: async (cursor) => {
          for (const _ of docs) {
            await cursor.next();
          }
          assert.strictEqual(cursor.state, 'started');
          assert.strictEqual(await cursor.hasNext(), false);
          assert.strictEqual(cursor.state, 'closed');
        },
      });

      overBYOAndVectorize({
        name: 'should not start the cursor if it is idle',
        test: async (cursor) => {
          assert.strictEqual(cursor.state, 'idle');
          await cursor.hasNext();
          assert.strictEqual(cursor.state, 'idle');
        },
      });

      overBYOAndVectorize({
        name: 'should not increase the amount of consumed documents',
        test: async (cursor) => {
          assert.strictEqual(cursor.consumed(), 0);
          await cursor.hasNext();
          assert.strictEqual(cursor.consumed(), 0);
        },
      });

      overBYOAndVectorize({
        name: 'should immediately resolve false if the cursor state is closed',
        sources: [source, source_], // only fair that we test this on a non-memoized cursor
        test: async (cursor) => {
          cursor.close();
          assert.strictEqual(cursor.state, 'closed');
          const hasNext = await assertPromiseResolvesImmediately(() => cursor.hasNext());
          assert.strictEqual(hasNext, false);
        },
      });

      overBYOAndVectorize({
        name: 'should not execute the cursor mapping when performing hasNext',
        test: async (cursor) => {
          let mapped = false;
          cursor = cursor.map((d) => {
            mapped = true;
            return d;
          });
          await cursor.hasNext();
          assert.strictEqual(mapped, false);
        },
      });
    });

    parallel('next', () => {
      overBYOAndVectorize({
        name: 'should return the next document in the cursor, consuming the buffer',
        test: async (cursor) => {
          const seenSet = new Set<unknown>(docs.map((d) => stableStringify({ [textKey]: d[textKey], int: d.int })));
          assert.strictEqual(cursor.buffered(), 0);

          for (const _ of docs) {
            const next = await cursor.next();
            assert.deepStrictEqual(next?.scores, {});
            seenSet.delete(stableStringify(next?.document));
            assert.strictEqual(cursor.buffered(), 3 - cursor.consumed());
          }

          assert.strictEqual(cursor.buffered(), 0);
          assert.strictEqual(seenSet.size, 0);
        },
      });

      overBYOAndVectorize({
        name: 'should return null if there are no more documents left to find',
        test: async (cursor) => {
          await cursor.toArray();
          assert.strictEqual(await cursor.next(), null);
        },
      });

      overBYOAndVectorize({
        name: 'should close the cursor if no more docs to find and its not already closed',
        test: async (cursor) => {
          for (const _ of docs) {
            await cursor.next();
          }
          assert.strictEqual(cursor.state, 'started');
          assert.strictEqual(await cursor.next(), null);
          assert.strictEqual(cursor.state, 'closed');
        },
      });

      overBYOAndVectorize({
        name: 'should start the cursor if it is idle',
        test: async (cursor) => {
          assert.strictEqual(cursor.state, 'idle');
          await cursor.next();
          assert.strictEqual(cursor.state, 'started');
        },
      });

      overBYOAndVectorize({
        name: 'should increase the amount of consumed documents',
        test: async (cursor) => {
          assert.strictEqual(cursor.consumed(), 0);
          await cursor.next();
          assert.strictEqual(cursor.consumed(), 1);
        },
      });

      overBYOAndVectorize({
        name: 'should immediately resolve null if the cursor state is closed',
        sources: [source, source_], // only fair that we test this on a non-memoized cursor
        test: async (cursor) => {
          cursor.close();
          assert.strictEqual(cursor.state, 'closed');
          const next = await assertPromiseResolvesImmediately(() => cursor.next());
          assert.strictEqual(next, null);
        },
      });

      overBYOAndVectorize({
        name: 'should execute the cursor mapping when performing next',
        test: async (cursor) => {
          const res = arbs.one(fc.anything());
          cursor = cursor.map(() => res);
          assert.strictEqual(await cursor.next(), res);
        },
      });
    });

    parallel('[Symbol.asyncIterator]', () => {
      overBYOAndVectorize({
        name: 'should iterate over all documents',
        test: async (cursor) => {
          const seenSet = new Set<unknown>(docs.map((d) => stableStringify(d)));
          for await (const doc of cursor) {
            seenSet.delete(stableStringify(doc));
          }
          assert.strictEqual(seenSet.size, 0);
          assert.strictEqual(cursor.consumed(), docs.length);
          assert.strictEqual(cursor.buffered(), 0);
        },
      });

      overBYOAndVectorize({
        name: 'should iterate over all documents with a mapping function',
        test: async (cursor) => {
          const seenSet = new Set<unknown>(docs.map((d) => stableStringify(d)));
          for await (const doc of cursor) {
            seenSet.delete(stableStringify(doc));
          }
          assert.strictEqual(seenSet.size, 0);
          assert.strictEqual(cursor.consumed(), docs.length);
          assert.strictEqual(cursor.buffered(), 0);
        },
      });

      overBYOAndVectorize({
        name: 'should not iterate over anything if no documents found',
        test: async (cursor) => {
          let i = 0;
          for await (const _ of cursor) {
            i++;
          }
          assert.strictEqual(i, 0);
          assert.strictEqual(cursor.consumed(), 0);
          assert.strictEqual(cursor.buffered(), 0);
        },
      });

      overBYOAndVectorize({
        name: 'should close the cursor once done iterating',
        test: async (cursor) => {
          for await (const _ of cursor) {
            // do nothing
          }
          assert.strictEqual(cursor.state, 'closed');
        },
      });

      overBYOAndVectorize({
        name: 'should close the cursor if interrupted by break',
        test: async (cursor) => {
          let i = 0;
          for await (const _ of cursor) {
            if (i++ === 1) break;
          }
          assert.strictEqual(cursor.state, 'closed');
        },
      });

      overBYOAndVectorize({
        name: 'should close the cursor if an exception is thrown',
        test: async (cursor) => {
          await assert.rejects(async () => {
            let i = 0;
            for await (const _ of cursor) {
              if (i++ === 1) throw new Error('oops');
            }
          }, {
            message: 'oops',
          });
          assert.strictEqual(cursor.state, 'closed');
        },
      });

      overBYOAndVectorize({
        name: 'should throw when attempting to iterate over a closed cursor',
        test: async (cursor) => {
          await assertIteratorThrowsOnClosed(cursor, async () => {
            for await (const _ of cursor) { /* do nothing */ }
          });
        },
      });
    });

    // parallel('toArray', () => {
    //   overBYOAndVectorize({
    //     name: 'should get all documents',
    //     test: async (cursor) => {
    //       const docs = await cursor.toArray();
    //       assert.deepStrictEqual(docs.sort(sortByText), docs_);
    //       assert.strictEqual(cursor.consumed(), docs_.length);
    //       assert.strictEqual(cursor.buffered(), 0);
    //     },
    //   });
    //
    //   overBYOAndVectorize({
    //     name: 'should iterate over all documents with a mapping function',
    //     test: async (cursor) => {
    //       const docs = await cursor.toArray();
    //       assert.deepStrictEqual(docs.sort(sortByInt), docs_.map(intToString));
    //       assert.strictEqual(cursor.consumed(), docs_.length);
    //       assert.strictEqual(cursor.buffered(), 0);
    //     },
    //   });
    //
    //   overBYOAndVectorize({
    //     name: 'should return an empty array if no documents found',
    //     test: async (cursor) => {
    //       assert.deepStrictEqual(await cursor.toArray(), []);
    //       assert.strictEqual(cursor.consumed(), 0);
    //       assert.strictEqual(cursor.buffered(), 0);
    //     },
    //   });
    //
    //   overBYOAndVectorize({
    //     name: 'should close the cursor once done fetching all docs',
    //     test: async (cursor) => {
    //       await cursor.toArray();
    //       assert.strictEqual(cursor.state, 'closed');
    //     },
    //   });
    //
    //   overBYOAndVectorize({
    //     name: 'should throw when attempting to iterate over a closed cursor',
    //     test: async (cursor) => {
    //       await assertIteratorThrowsOnClosed(cursor, () => cursor.toArray());
    //     },
    //   });
    // });
  });
};
