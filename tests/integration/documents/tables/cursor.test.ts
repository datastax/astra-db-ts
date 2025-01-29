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

import { DataAPIVector, SomeDoc } from '@/src/documents';
import {
  DEFAULT_TABLE_NAME,
  describe,
  EverythingTableSchema,
  initCollectionWithFailingClient,
  it,
  OTHER_KEYSPACE,
  parallel,
} from '@/tests/testlib';
import assert from 'assert';

describe('integration.documents.tables.cursor', { truncate: 'tables:before' }, ({ db }) => {
  const sortByText = (a: SomeDoc, b: SomeDoc) => parseInt(a.text) - parseInt(b.text);
  const sortByInt = (a: SomeDoc, b: SomeDoc) => a.int - b.int;

  const intToString = (doc: SomeDoc) => ({ int: `${doc.int}` });
  const textToNum = (doc: SomeDoc) => ({ text: parseInt(doc.text) });

  const docs = <const>[{ text: '0', int: 0 }, { text: '1', int: 1 }, { text: '2', int: 2 }];
  const docs_ = Array.from({ length: 100 }, (_, i) => <const>{ text: (i < 10 ? '0' : '') + `${i}`, int: i });

  const table = db.table<EverythingTableSchema>(DEFAULT_TABLE_NAME, { serdes: { sparseData: true } });
  const table_ = db.table<EverythingTableSchema>(DEFAULT_TABLE_NAME, { keyspace: OTHER_KEYSPACE, serdes: { sparseData: true } });

  before(async () => {
    await table.insertMany(docs);
    await table_.insertMany(docs_, { ordered: true });
  });

  parallel('hasNext() tests', () => {
    it('should test if there are more documents with hasNext()', async () => {
      const cursor = table.find({});
      const next = await cursor.next();
      assert.ok(next, 'Cursor did not read next');
      const hasNext = await cursor.hasNext();
      assert.strictEqual(hasNext, true);
    });

    it('should test if there are more documents with hasNext() with no buffer set', async () => {
      const cursor = table.find({});
      const hasNext = await cursor.hasNext();
      assert.strictEqual(hasNext, true);
    });

    it('should test if there are no more documents with hasNext()', async () => {
      const cursor = table.find({});
      for (let i = 0; i < 3; i++) {
        const doc = await cursor.next();
        assert.ok(doc, `Doc #${i} is null`);
      }
      const hasNext = await cursor.hasNext();
      assert.strictEqual(hasNext, false);
    });
  });

  parallel('next() tests', () => {
    it('should get next document with next()', async () => {
      const cursor = table.find({});
      const doc = await cursor.next();
      assert.deepStrictEqual(doc, docs[0]);
      assert.equal(cursor.state, 'started');
      assert.strictEqual(cursor.buffered(), 2);
    });

    it('should get 21st document with next()', async () => {
      const cursor = table_.find({});

      let doc: any;
      for (let i = 0; i < 21; i++) {
        doc = await cursor.next();
        if (i !== 20) {
          assert.ok(doc, `Doc #${i} is null`);
        }
      }

      assert.ok(doc, 'Doc is not the 21st in the collections');
      assert.equal(cursor.state, 'started');
      assert.strictEqual(cursor.buffered(), 19);
    });

    it('should return null if there are no more documents with next()', async () => {
      const cursor = table.find({ text: '0' });
      const doc = await cursor.next();
      assert.ok(doc, 'Doc is null');
      const next = await cursor.next();
      assert.strictEqual(next, null);
    });

    it('Provides the next document with a mapping function', async () => {
      const cursor = table.find({}).map(intToString);
      const doc = await cursor.next();
      assert.ok(doc, 'Doc is null');
      assert.ok(typeof doc['int'] === 'string');
      assert.equal(cursor.state, 'started');
      assert.strictEqual(cursor.buffered(), 2);
    });
  });

  parallel('toArray() tests', () => {
    it('Gets all documents with toArray()', async () => {
      const cursor = table.find({});
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortByText), docs);
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
    });

    it('Gets all documents with toArray() with a mapping function', async () => {
      const cursor = table.find({}).map(intToString);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortByInt), docs.map(intToString));
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
    });

    it('Gets all documents with toArray() with no documents', async () => {
      const cursor = table.find({ text: 'Iron Maiden' });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, []);
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
    });

    it('should throw an error when toArray() called a second time', async () => {
      const cursor = table.find({});
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortByText), docs);
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
      await assert.rejects(() => cursor.toArray());
      assert.equal(cursor.state, 'closed');
    });
  });

  parallel('filter tests', () => {
    it('should filter documents', async () => {
      const cursor = table.find({}).filter({ text: '1' });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [docs[1]]);
    });

    it('should filter documents with a mapping function', async () => {
      const cursor = table.find({}).filter({ text: '1' }).map(intToString);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [intToString(docs[1])]);
    });
  });

  parallel('skip/limit tests', () => {
    it('should limit documents', async () => {
      const cursor = table.find({}).limit(2);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.length, 2);
    });

    it('should limit documents across pints', async () => {
      const cursor = table_.find({}).limit(50);
      const res = await cursor.toArray();
      assert.strictEqual(res.length, 50);
    });

    it('should have no limit if limit is set to 0', async () => {
      const cursor = table_.find({}).limit(0);
      const res = await cursor.toArray();
      assert.strictEqual(res.length, docs_.length, 'Cursor limited documents');
    });

    it('should skip documents', async () => {
      const cursor = table.find({}).skip(1).sort({ text: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortByText), docs.slice(1));
    });

    it('should skip documents across pints', async () => {
      const cursor = table_.find({}).skip(50).sort({ text: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, docs_.slice(50, 70));
    });

    it('should limit and skip documents across pints', async () => {
      const cursor = table_.find({}).skip(50).limit(20).sort({ text: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, docs_.slice(50, 70));
    });
  });

  parallel('sort tests', () => {
    it('should sort documents', async () => {
      const cursor = table_.find({}).sort({ text: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [...docs_].slice(0, 20).sort(sortByText));
    });

    it('should sort documents with a mapping function', async () => {
      const cursor = table.find({}).sort({ text: 1 }).map(textToNum);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [...docs].sort(sortByText).map(textToNum));
    });
  });

  parallel('projection tests', () => {
    it('should project documents', async () => {
      const cursor = table.find({}).project({ int: 0 }).sort({ text: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [{ text: '0' }, { text: '1' }, { text: '2' }]);
    });

    it('should project documents with a mapping function', async () => {
      const cursor = table.find({}).project<{ text: string }>({ text: 1 }).map(textToNum).sort({ text: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [{ text: 0 }, { text: 1 }, { text: 2 }]);
    });
  });

  parallel('mapping tests', () => {
    it('should map documents', async () => {
      const cursor = table.find({}).map(intToString);
      const res = await cursor.toArray();
      assert.deepStrictEqual(new Set(res), new Set([{ int: '0' }, { int: '1' }, { int: '2' }]));
    });

    it('should close cursor and rethrow error if mapping function throws', async () => {
      const cursor = table.find({}).map(() => { throw new Error('Mapping error'); });
      await assert.rejects(async () => await cursor.toArray(), { message: 'Mapping error' });
      assert.equal(cursor.state, 'closed');
    });
  });

  parallel('sort vector tests', () => {
    before(async () => {
      await table.insertMany(Array.from({ length: 3 }, (_, i) => <const>{ text: `vector${i}`, int: i, vector: new DataAPIVector([1, 1, 1, 1, 1]) }));
    });

    it('should return sort vector on only first API call if includeSortVector: true', async () => {
      const cursor = table.find({}).sort({ vector: [1, 1, 1, 1, 1] }).includeSortVector();
      const start1 = performance.now();
      assert.deepStrictEqual((await cursor.getSortVector())?.asArray(), [1, 1, 1, 1, 1]);
      assert.ok(performance.now() - start1 > 5);
      const start2 = performance.now();
      assert.deepStrictEqual((await cursor.getSortVector())?.asArray(), [1, 1, 1, 1, 1]);
      assert.ok(performance.now() - start2 < 2);
    });

    it('getSortVector should populate buffer if called first w/ includeSortVector: true', async () => {
      const cursor = table.find({}).sort({ vector: [1, 1, 1, 1, 1] }).includeSortVector();
      assert.deepStrictEqual((await cursor.getSortVector())?.asArray(), [1, 1, 1, 1, 1]);
      assert.strictEqual(cursor.consumeBuffer().length, 3);
    });

    it('should return null in getSortVector if includeSortVector: false', async () => {
      const cursor = table.find({}).sort({ vector: [1, 1, 1, 1, 1] });
      await cursor.hasNext();
      assert.deepStrictEqual(await cursor.getSortVector(), null);
    });

    it('should return null in getSortVector if no sort vector', async () => {
      const cursor = table_.find({}).includeSortVector();
      await cursor.hasNext();
      assert.strictEqual(await cursor.getSortVector(), null);
    });
  });

  parallel('misc', () => {
    it('should close cursor and rethrow error if getting documents throws', async () => {
      const cursor = initCollectionWithFailingClient().find({});
      await assert.rejects(async () => await cursor.toArray(), { message: 'failing_client' });
      assert.equal(cursor.state, 'closed');
    });
  });
});
