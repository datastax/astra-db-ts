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
import { CursorError, RerankedResult } from '@/src/documents/index.js';
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
    // const memoizedSourceBYO = memoizeRequests(cfg.mkSourceBYO()); // for tests that don't depend on an up-to-date result from the server
    const memoizedSourceVectorize = memoizeRequests(cfg.mkSourceVectorize());

    const textKey = cfg.for === 'tables' ? 'text' : '_id';
    const vectorKey = cfg.for === 'tables' ? 'vector' : '$vector';
    const lexicalKey = cfg.for === 'tables' ? '$iLikeCars123' : '$lexical';
    const vectorizeKey = cfg.for === 'tables' ? 'vector1' : '$vectorize';

    const intToString = (res: RerankedResult<SomeDoc>) => ({ int: `${res.document.int}` });

    const inOrder = <T extends { text?: string, _id?: string, int: number }>(docs: T[], ...order: number[]) => order.map((i) => ({ [textKey]: docs[i][textKey], int: docs[i].int}));
    const inOrderResults = <T extends { int: number }>(docs: T[], ...order: number[]) => inOrder(docs, ...order).map((doc) => new RerankedResult(doc, {}));

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

    const cartProd = ({ vectors, strings }: { vectors: number[][], strings: string[] }) => {
      return vectors.flatMap(vector => strings.map(lexical => ({ [vectorKey]: vector, [lexicalKey]: lexical })));
    };

    const docsBYOCommon = cartProd({
      vectors: [
        [.1, .1, .1, .1, .1],
        [.5, .3, .3, .4, .5],
        [.1, .3, .5, .3, .1],
      ],
      strings: [
        'I like red cars',
        'I drive a red car',
        'I drive to work',
      ],
    });

    const docsBYO = Array.from({ length: 100 }, (_, i) => ({
      [textKey]: i.toString(),
      int: i,
      ...docsBYOCommon[i % docsBYOCommon.length],
    }));

    const docsVectorize = [
      { [textKey]: '0', int: 0, [vectorizeKey]: 'I like red cars', [lexicalKey]: 'I like red cars' },
      { [textKey]: '1', int: 1, [vectorizeKey]: 'I drive a red car', [lexicalKey]: 'I drive a red car' },
      { [textKey]: '2', int: 2, [vectorizeKey]: 'I drive to work', [lexicalKey]: 'I drive to work' },
    ];

    const strings = docsVectorize.map(doc => doc[lexicalKey] as string);

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

        for (const _ of docsVectorize) {
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
        const seen = [];

        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } });

        assert.strictEqual(cursor.buffered(), 0);
        for (const _ of docsVectorize) {
          seen.push(await cursor.next());
          assert.strictEqual(cursor.buffered(), 3 - cursor.consumed());
        }
        assert.strictEqual(cursor.buffered(), 0);
        assert.deepStrictEqual(seen, inOrderResults(docsVectorize, 0, 1, 2));
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

        for (const _ of docsVectorize) {
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
          .sort({ $hybrid: { [vectorizeKey]: strings[1], [lexicalKey]: strings[1] } });

        const seen = [];

        for await (const doc of cursor) {
          seen.push(doc);
          assert.strictEqual(cursor.buffered(), 3 - cursor.consumed());
        }

        assert.deepStrictEqual(seen, inOrderResults(docsVectorize, 1, 0, 2));
        assert.strictEqual(cursor.consumed(), docsVectorize.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should iterate over all documents with a mapping function', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[1], [lexicalKey]: strings[1] } })
          .map((d) => stableStringify(d));

        const seen = [];

        for await (const doc of cursor) {
          seen.push(doc);
          assert.strictEqual(cursor.buffered(), 3 - cursor.consumed());
        }

        assert.deepStrictEqual(seen, inOrderResults(docsVectorize, 1, 0, 2).map((d) => stableStringify(d)));
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
          .sort({ $hybrid: { [vectorizeKey]: strings[2], [lexicalKey]: strings[2] } });

        const docs = await cursor.toArray();
        assert.deepStrictEqual(docs, inOrderResults(docsVectorize, 2, 1, 0));
        assert.strictEqual(cursor.consumed(), docsVectorize.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should get all documents with a mapping function', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[2], [lexicalKey]: strings[2] } })
          .map(intToString);

        const docs = await cursor.toArray();
        assert.deepStrictEqual(docs, inOrderResults(docsVectorize, 2, 1, 0).map((d) => intToString(d)));
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

        const seen = [] as unknown[];

        await cursor.forEach((doc) => {
          seen.push(doc);
          assert.strictEqual(cursor.buffered(), 3 - cursor.consumed());
        });

        assert.deepStrictEqual(seen, inOrderResults(docsVectorize, 0, 1, 2));
        assert.strictEqual(cursor.consumed(), docsVectorize.length);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should iterate over all documents with a mapping function', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[1], [lexicalKey]: strings[1] } })
          .map((d) => stableStringify(d));

        const seen = [] as unknown[];

        await cursor.forEach((doc) => {
          seen.push(doc);
          assert.strictEqual(cursor.buffered(), 3 - cursor.consumed());
        });

        assert.deepStrictEqual(seen, inOrderResults(docsVectorize, 1, 0, 2).map((d) => stableStringify(d)));
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
      it('should omit documents not matching the filter', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({ int: { $lt: 2 } })
          .sort({ $hybrid: { [vectorizeKey]: strings[1], [lexicalKey]: strings[1] } });

        assert.deepStrictEqual(await cursor.toArray(), inOrderResults(docsVectorize, 1, 0));
      });
    });

    parallel('limit tests', () => {
      it('should limit documents', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[2], [lexicalKey]: strings[2] } })
          .limit(2);

        assert.deepStrictEqual(await cursor.toArray(), inOrderResults(docsVectorize, 2, 1));
      });

      it('should have no limit if limit is set to 0', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } })
          .limit(0);

        assert.deepStrictEqual(await cursor.toArray(), inOrderResults(docsVectorize, 0, 1, 2));
      });
    });

    parallel('projection tests', () => {
      it('should project documents', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[2], [lexicalKey]: strings[2] } })
          .project({ int: 0 });

        assert.deepStrictEqual(await cursor.toArray(), inOrder(docsVectorize, 2, 1, 0).map((d) => new RerankedResult({ [textKey]: d[textKey] }, {})));
      });
    });

    parallel('mapping tests', () => {
      it('should map documents', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } })
          .map(intToString);

        assert.deepStrictEqual(await cursor.toArray(), inOrderResults(docsVectorize, 0, 1, 2).map(intToString));
      });

      it('should compose mapping functions', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[1], [lexicalKey]: strings[1] } })
          .map((d) => d.document.int)
          .map((i) => i + 5)
          .map((i) => i * 2);

        assert.deepStrictEqual(await cursor.toArray(), inOrder(docsVectorize, 1, 0, 2).map((d) => (d.int + 5) * 2));
      });

      it('should close cursor and rethrow error if mapping function throws', async () => {
        const cursor = memoizedSourceVectorize.findAndRerank({})
          .sort({ $hybrid: { [vectorizeKey]: strings[0], [lexicalKey]: strings[0] } })
          .map(() => { throw new Error('Mapping error'); });

        await assert.rejects(async () => await cursor.toArray(), { message: 'Mapping error' });
        assert.equal(cursor.state, 'closed');
      });
    });

    parallel('sort vector tests', () => {
      const sortVector = docsBYO[0][vectorKey] as number[];

      it('should return sort vector on only first API call if includeSortVector: true', async () => {
        const cursor = sourceBYO.findAndRerank({})
          .sort({ $hybrid: { [vectorKey]: sortVector, [lexicalKey]: 'I like red cars' } })
          .rerankQuery('I like red cars')
          .rerankOn('$lexical')
          .includeSortVector();

        const start = performance.now();
        assert.deepStrictEqual((await cursor.getSortVector())?.asArray(), sortVector);
        assert.ok(performance.now() - start > 5);

        const cachedVector = await assertPromiseResolvesImmediately(() => cursor.getSortVector());
        assert.deepStrictEqual(cachedVector?.asArray(), sortVector);
      });

      it('getSortVector should populate buffer if called first w/ includeSortVector: true', async () => {
        const cursor = sourceBYO.findAndRerank({})
          .sort({ $hybrid: { [vectorKey]: sortVector, [lexicalKey]: 'I like red cars' } })
          .rerankQuery('I like red cars')
          .rerankOn('$lexical')
          .includeSortVector();

        assert.deepStrictEqual((await cursor.getSortVector())?.asArray(), sortVector);
        assert.ok(cursor.consumeBuffer().length > 0);
      });

      it('should return null in getSortVector if includeSortVector: false', async () => {
        const cursor = sourceBYO.findAndRerank({})
          .sort({ $hybrid: { [vectorKey]: sortVector, [lexicalKey]: 'I like red cars' } })
          .rerankQuery('I like red cars')
          .rerankOn('$lexical');

        await cursor.hasNext();
        assert.deepStrictEqual(await cursor.getSortVector(), null);
      });
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
