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

import type { Collection, FindAndRerankCursor, SomeDoc } from '@/src/documents/index.js';
import { CursorError, RerankResult } from '@/src/documents/index.js';
import { assertPromiseResolvesImmediately, memoizeRequests } from '@/tests/testlib/utils.js';
import assert from 'assert';
import { describe, it, parallel } from '@/tests/testlib/index.js';
import stableStringify from 'safe-stable-stringify';
import { arbs } from '@/tests/testlib/arbitraries.js';
import fc from 'fast-check';

interface FindCursorTestConfig {
  for: 'tables' | 'colls';
  mkSourceBYO: () => Collection,
  mkSourceVectorize: () => Collection,
}

export const integrationTestRerankCursor = (cfg: FindCursorTestConfig) => {
  describe('common', { truncate: `${cfg.for}:before` }, () => {
    const sourceBYO = cfg.mkSourceBYO();
    const sourceVectorize = cfg.mkSourceVectorize();
    const memoizedSourceBYO = memoizeRequests(cfg.mkSourceBYO()); // for tests that don't depend on an up-to-date result from the server
    const memoizedSourceVectorize = memoizeRequests(cfg.mkSourceVectorize());

    const textKey = cfg.for === 'tables' ? 'text' : '_id';
    const vectorKey = cfg.for === 'tables' ? 'vector' : '$vector';
    const lexicalKey = cfg.for === 'tables' ? '$iLikeCars123' : '$lexical';
    const vectorizeKey = cfg.for === 'tables' ? 'vector1' : '$vectorize';

    const intToString = (doc: SomeDoc) => ({ int: `${doc.int}` });
    const textToNum = (doc: SomeDoc) => ({ [textKey]: parseInt(doc[textKey]) });

    const assertIteratorThrowsOnClosed = async (cb: (cursor: FindAndRerankCursor<unknown>) => Promise<unknown>) => {
      const cursor = memoizedSourceVectorize.findAndRerank({})
        .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

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

    const permutations = <T>(arr: T[]): T[][] => {
      if (arr.length === 0) return [[]];

      const [head, ...tail] = arr;

      return permutations(tail).flatMap((perm) => {
        return Array.from({ length: perm.length + 1 }, (_, i) => {
          return [...perm.slice(0, i), head, ...perm.slice(i)];
        });
      });
    };

    const docsBYOCommon = permutations([
      { [vectorKey]: [.1, .1, .1, .1, .1], [lexicalKey]: 'I like cars' },
      { [vectorKey]: [.5, .3, .3, .4, .5], [lexicalKey]: 'I like bikes' },
      { [vectorKey]: [.1, .3, .5, .3, .1], [lexicalKey]: 'I like boats' },
    ]);

    const docsBYO = Array.from({ length: 100 }, (_, i) => ({
      [textKey]: i.toString(),
      int: i,
      ...docsBYOCommon[i % docsBYOCommon.length],
    }));

    const docsVectorize = [
      { [textKey]: '0', int: 0, [vectorizeKey]: 'I like cars',  [lexicalKey]: 'I like cars' },
      { [textKey]: '1', int: 1, [vectorizeKey]: 'I like bikes', [lexicalKey]: 'I like bikes' },
      { [textKey]: '2', int: 2, [vectorizeKey]: 'I like boats', [lexicalKey]: 'I like boats' },
    ];

    const strings = docsVectorize.map(doc => doc[lexicalKey] as string);
    const expectedDocsVectorize = docsVectorize.map((doc) => new RerankResult({ [textKey]: doc[textKey], int: doc.int }, {}));

    before(async () => {
      await sourceBYO.insertMany(docsBYO);
      await sourceVectorize.insertMany(docsVectorize);
    });

    parallel('hasNext', () => {
      it('should return true if there are more documents, setting the buffer', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        assert.strictEqual(cursor.buffered(), 0);
        assert.strictEqual(await cursor.hasNext(), true);
        assert.strictEqual(cursor.buffered(), 3);
      });

      it('should return true if there are more documents left in the buffer, without touching it', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        await cursor.next();

        assert.strictEqual(cursor.buffered(), 2);
        assert.strictEqual(await cursor.hasNext(), true);
        assert.strictEqual(cursor.buffered(), 2);
      });

      it('should return false if there are no more documents left to find', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        await cursor.toArray();

        assert.strictEqual(cursor.buffered(), 0);
        assert.strictEqual(await cursor.hasNext(), false);
      });

      it('should close the cursor if no more docs to find and its not already closed', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        for (const _ of docsBYO) {
          await cursor.next();
        }

        assert.strictEqual(cursor.state, 'started');
        assert.strictEqual(await cursor.hasNext(), false);
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should not start the cursor if it is idle', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        assert.strictEqual(cursor.state, 'idle');
        await cursor.hasNext();
        assert.strictEqual(cursor.state, 'idle');
      });

      it('should not increase the amount of consumed documents', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        assert.strictEqual(cursor.consumed(), 0);
        await cursor.hasNext();
        assert.strictEqual(cursor.consumed(), 0);
      });

      it('should immediately resolve false if the cursor state is closed', async () => {
        const cursor = sourceVectorize.findAndRerank({}) // only fair that we test this on a non-memoized cursor
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        cursor.close();
        assert.strictEqual(cursor.state, 'closed');
        const hasNext = await assertPromiseResolvesImmediately(() => cursor.hasNext());
        assert.strictEqual(hasNext, false);
      });

      it('should not execute the cursor mapping when performing hasNext', async () => {
        let mapped = false;

        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({
            $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] },
          })
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
        const seenSet = new Set(expectedDocsVectorize.map((d) => stableStringify(d)));

        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        assert.strictEqual(cursor.buffered(), 0);
        for (const _ of docsBYO) {
          seenSet.delete(stableStringify(await cursor.next()));
          assert.strictEqual(cursor.buffered(), 3 - cursor.consumed());
        }
        assert.strictEqual(cursor.buffered(), 0);
        assert.strictEqual(seenSet.size, 0);
      });

      it('should return null if there are no more documents left to find', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        await cursor.toArray();
        assert.strictEqual(await cursor.next(), null);
      });

      it('should close the cursor if no more docs to find and its not already closed', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        for (const _ of docsBYO) {
          await cursor.next();
        }

        assert.strictEqual(cursor.state, 'started');
        assert.strictEqual(await cursor.next(), null);
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should start the cursor if it is idle', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        assert.strictEqual(cursor.state, 'idle');
        await cursor.next();
        assert.strictEqual(cursor.state, 'started');
      });

      it('should increase the amount of consumed documents', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        assert.strictEqual(cursor.consumed(), 0);
        await cursor.next();
        assert.strictEqual(cursor.consumed(), 1);
      });

      it('should immediately resolve null if the cursor state is closed', async () => {
        const cursor = sourceVectorize.findAndRerank({}) // only fair that we test this on a non-memoized cursor
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        cursor.close();
        assert.strictEqual(cursor.state, 'closed');
        const next = await assertPromiseResolvesImmediately(() => cursor.next());
        assert.strictEqual(next, null);
      });

      it('should execute the cursor mapping when performing next', async () => {
        const res = arbs.one(fc.anything());

        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } })
          .map(() => res);

        assert.strictEqual(await cursor.next(), res);
      });
    });

    parallel('[Symbol.asyncIterator]', () => {
      it('should iterate over all documents', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        const seenSet = new Set(expectedDocsVectorize.map((d) => stableStringify(d)));

        for await (const doc of cursor) {
          seenSet.delete(stableStringify(doc));
        }

        assert.strictEqual(seenSet.size, 0);
        assert.strictEqual(cursor.consumed(), docsVectorize.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should iterate over all documents with a mapping function', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } })
          .map((d) => stableStringify(d));

        const seenSet = new Set(expectedDocsVectorize.map((d) => stableStringify(d)));

        for await (const doc of cursor) {
          seenSet.delete(doc);
        }

        assert.strictEqual(seenSet.size, 0);
        assert.strictEqual(cursor.consumed(), docsVectorize.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should not iterate over anything if no documents found', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({ [textKey]: 'Shallow Green' })
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        let i = 0;

        for await (const _ of cursor) {
          i++;
        }

        assert.strictEqual(i, 0);
        assert.strictEqual(cursor.consumed(), 0);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should close the cursor once done iterating', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        for await (const _ of cursor) {
          // do nothing
        }
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should close the cursor if interrupted by break', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        let i = 0;
        for await (const _ of cursor) {
          if (i++ === 1) break;
        }

        assert.strictEqual(cursor.state, 'closed');
      });

      it('should close the cursor if an exception is thrown', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

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
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        const docs = await cursor.toArray();
        assert.deepStrictEqual(docs, expectedDocsVectorize);
        assert.strictEqual(cursor.consumed(), docsVectorize.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should get all documents with a mapping function', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } })
          .map((d) => d.document)
          .map(intToString);

        const docs = await cursor.toArray();
        assert.deepStrictEqual(docs, expectedDocsVectorize.map((d) => intToString(d.document)));
        assert.strictEqual(cursor.consumed(), docsVectorize.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should return an empty array if no documents found', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({ [textKey]: 'Purple Night' })
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        assert.deepStrictEqual(await cursor.toArray(), []);
        assert.strictEqual(cursor.consumed(), 0);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should close the cursor once done fetching all docs', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        await cursor.toArray();
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should throw when attempting to iterate over a closed cursor', async () => {
        await assertIteratorThrowsOnClosed((cursor) => cursor.toArray());
      });
    });

    parallel('forEach', () => {
      it('should iterate over all documents', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        const seenSet = new Set<unknown>(expectedDocsVectorize.map((d) => stableStringify(d)));

        await cursor.forEach((doc) => {
          seenSet.delete(stableStringify(doc));
        });

        assert.strictEqual(seenSet.size, 0);
        assert.strictEqual(cursor.consumed(), docsVectorize.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should iterate over all documents with a mapping function', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } })
          .map((d) => stableStringify(d));

        const seenSet = new Set<unknown>(expectedDocsVectorize.map((d) => stableStringify(d)));

        await cursor.forEach((doc) => {
          seenSet.delete(doc);
        });

        assert.strictEqual(seenSet.size, 0);
        assert.strictEqual(cursor.consumed(), docsVectorize.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should not iterate over anything if no documents found', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({ [textKey]: 'Shallow Green' })
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        let i = 0;
        await cursor.forEach(() => {
          i++;
        });

        assert.strictEqual(i, 0);
        assert.strictEqual(cursor.consumed(), 0);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should close the cursor once done iterating', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        await cursor.forEach(() => {});
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should close the cursor if interrupted by returning false', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        await cursor.forEach(() => {
          return false;
        });
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should close the cursor if interrupted by returning Promise<false>', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        await cursor.forEach(() => {
          return Promise.resolve(false);
        });
        assert.strictEqual(cursor.state, 'closed');
      });

      it('should close the cursor if an exception is thrown', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

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

    });

    parallel('misc', () => {
      it('should close cursor and rethrow error if getting documents throws', async () => {
        const source = cfg.mkSourceBYO();
        source._httpClient.executeCommand = () => { throw new Error('failing_client'); };
        const cursor = source.findAndRerank({});
        await assert.rejects(async () => await cursor.toArray(), { message: 'failing_client' });
        assert.equal(cursor.state, 'closed');
      });
    });
  });
};
