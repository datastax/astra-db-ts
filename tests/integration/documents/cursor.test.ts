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

import { CursorIsStartedError, DataAPIResponseError, SomeDoc } from '@/src/documents';
import { describe, it, parallel } from '@/tests/testlib';
import assert from 'assert';

describe('integration.documents.cursor', { truncateColls: 'both:before' }, ({ collection, collection_ }) => {
  const sortById = (a: SomeDoc, b: SomeDoc) => parseInt(a._id) - parseInt(b._id);
  const sortByAge = (a: SomeDoc, b: SomeDoc) => a.age - b.age;

  const ageToString = (doc: SomeDoc) => ({ age: `${doc.age}` });

  const docs = [{ _id: '0', age: 0 }, { _id: '1', age: 1 }, { _id: '2', age: 2 }];
  const docs_ = Array.from({ length: 100 }, (_, i) => ({ _id: (i < 10 ? '0' : '') + `${i}` }));

  before(async () => {
    await collection.insertMany(docs);
    await collection_.insertMany(docs_, { ordered: true });
  });

  parallel('cursor lifecycle manipulation', () => {
    it('closes cursor', async () => {
      const cursor = collection.find({});
      cursor.close();
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [], 'Cursor did not close');
    });

    it('clones cursor without sharing state', async () => {
      const cursor = collection.find({},{  projection: { _id: 0 } }).sort({ name: 1 }).map(ageToString);
      await cursor.hasNext();
      assert.strictEqual(cursor['_state'], 1, 'Cursor is not set to the INITIALIZED state');
      assert.strictEqual(cursor.bufferedCount(), 3, 'Cursor did not set buffer');
      cursor.close();

      const clone = cursor.clone();
      assert.deepStrictEqual(clone['_buffer'], [], 'Cursor clone shares _buffer');
      assert.strictEqual(clone.closed, false, 'Cursor clone is closed');
      assert.strictEqual(clone['_state'], 0, 'Cursor clone is not set to the UNINITIALIZED state');
      assert.strictEqual(clone.keyspace, 'default_keyspace', 'Cursor clone has bad keyspace');
      assert.deepStrictEqual(clone['_options'].projection, { _id: 0 }, 'Cursor clone has bad projection');
      assert.deepStrictEqual(clone['_options'].sort, { name: 1 }, 'Cursor clone has bad sort');
    });

    it('should not copy the mapping function', () => {
      const cursor = collection.find({});
      cursor.map(() => 3);
      const clone = cursor.clone();
      assert.strictEqual(clone['_mapping'], undefined, 'Cursor clone has bad mapping');
    });

    it('should let you build on a cloned cursor', async () => {
      const cursor = collection.find({});
      await cursor.hasNext();
      assert.strictEqual(cursor['_state'], 1, 'Cursor is not set to the INITIALIZED state');
      assert.strictEqual(cursor.bufferedCount(), 3, 'Cursor did not set buffer');

      cursor.close();
      const filter = { _id: docs[1]._id };
      assert.throws(() => cursor.filter(filter), CursorIsStartedError);
      const clone = cursor.clone();
      clone.filter(filter);
      assert.deepStrictEqual(clone['_filter'], filter, 'Cursor did not set new filter');
    });

    it('should rewind cursor', async () => {
      const cursor = collection.find({});
      await cursor.hasNext();
      assert.strictEqual(cursor['_state'], 1, 'Cursor is not set to the INITIALIZED state');
      assert.strictEqual(cursor.bufferedCount(), 3, 'Cursor did not set buffer');

      cursor.rewind();
      assert.strictEqual(cursor['_state'], 0, 'Cursor is not set to the UNINITIALIZED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not reset buffer');
    });

    it('should allow cloned cursor to re-fetch all data', async () => {
      const cursor = collection.find({});
      cursor.close();
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [], 'Cursor did not close');
      assert.deepStrictEqual(cursor.bufferedCount(), 0, 'Cursor read docs');

      const clone = cursor.clone();
      const res2 = await clone.toArray();
      assert.deepStrictEqual(res2.sort(sortById), docs, 'Cursor did not re-fetch all documents');
    });

    it('should allow cloned cursor with mapping function to re-fetch all data without mapping', async () => {
      const cursor = collection.find({}).map(ageToString);
      cursor.close();
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [], 'Cursor did not close');
      assert.deepStrictEqual(cursor.bufferedCount(), 0, 'Cursor read docs');

      const clone = cursor.clone();
      const res2 = await clone.toArray();
      assert.deepStrictEqual(res2.sort(sortById), docs, 'Cursor did not re-fetch all documents');
    });

    it('should allow rewind-ed cursor to re-fetch all data', async () => {
      const cursor = collection.find({});
      cursor.close();
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [], 'Cursor did not close');
      assert.deepStrictEqual(cursor.bufferedCount(), 0, 'Cursor read docs');

      cursor.rewind();
      const res2 = await cursor.toArray();
      assert.deepStrictEqual(res2.sort(sortById), docs, 'Cursor did not re-fetch all documents');
    });

    it('should allow rewind-ed cursor with mapping function to re-fetch all data with mapping', async () => {
      const cursor = collection.find({}).map(ageToString);
      cursor.close();
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [], 'Cursor did not close');
      assert.deepStrictEqual(cursor.bufferedCount(), 0, 'Cursor read docs');

      cursor.rewind();
      const res2 = await cursor.toArray();
      assert.deepStrictEqual(res2.sort(sortById), docs.map(ageToString), 'Cursor did not re-fetch all documents');
    });
  });

  parallel('hasNext() tests', () => {
    it('should test if there are more documents with hasNext()', async () => {
      const cursor = collection.find({});
      const next = await cursor.next();
      assert.ok(next, 'Cursor did not read next');
      const hasNext = await cursor.hasNext();
      assert.strictEqual(hasNext, true, 'Cursor did not properly check for more documents');
    });

    it('should test if there are more documents with hasNext() with no buffer set', async () => {
      const cursor = collection.find({});
      const hasNext = await cursor.hasNext();
      assert.strictEqual(hasNext, true, 'Cursor did not properly check for more documents');
    });

    it('should test if there are no more documents with hasNext()', async () => {
      const cursor = collection.find({});
      for (let i = 0; i < 3; i++) {
        const doc = await cursor.next();
        assert.ok(doc, `Doc #${i} is null`);
      }
      const hasNext = await cursor.hasNext();
      assert.strictEqual(hasNext, false, 'Cursor did not properly check for more documents');
    });
  });

  parallel('readBufferedDocuments() tests', () => {
    it('should read all raw buffered documents', async () => {
      const cursor = collection.find({});
      await cursor.hasNext();
      assert.strictEqual(cursor['_state'], 1, 'Cursor is not set to the INITIALIZED state');
      assert.strictEqual(cursor.bufferedCount(), 3, 'Cursor did not set buffer');

      const raw = cursor.readBufferedDocuments();
      assert.strictEqual(raw.length, 3, 'Cursor did not read 3 buffered documents');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.deepStrictEqual(raw.sort(sortById), docs, 'Cursor did not read raw buffered documents');
    });

    it('should read all raw buffered documents with a max', async () => {
      const cursor = collection.find({});
      await cursor.hasNext();
      assert.strictEqual(cursor['_state'], 1, 'Cursor is not set to the INITIALIZED state');
      assert.strictEqual(cursor.bufferedCount(), 3, 'Cursor did not set buffer');
      cursor['_buffer'] = cursor['_buffer'].sort(sortById); // Only for testing purposes
      const raw = cursor.readBufferedDocuments(2);
      assert.strictEqual(raw.length, 2, 'Cursor did not read 2 buffered documents');
      assert.strictEqual(cursor.bufferedCount(), 1, 'Cursor did not properly consume buffer');
      assert.deepStrictEqual(raw.sort(sortById), docs.slice(0, 2), 'Cursor did not read raw buffered documents');
    });

    it('should read all raw buffered documents even with transformation', async () => {
      const cursor = collection.find({}).map(() => ({ _id: 0 }));
      await cursor.hasNext();
      assert.strictEqual(cursor['_state'], 1, 'Cursor is not set to the INITIALIZED state');
      assert.strictEqual(cursor.bufferedCount(), 3, 'Cursor did not set buffer');

      const raw = cursor.readBufferedDocuments();
      assert.strictEqual(raw.length, 3, 'Cursor did not read 3 buffered documents');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.deepStrictEqual(raw.sort(sortById), docs, 'Cursor did not read raw buffered documents');
    });
  });

  parallel('next() tests', () => {
    it('should get next document with next()', async () => {
      const cursor = collection.find({});
      const doc = await cursor.next();
      assert.deepStrictEqual(doc, docs[0], 'Doc is not the first in the collections');
      assert.strictEqual(cursor['_state'], 1, 'Cursor is not set to the INITIALIZED state');
      assert.strictEqual(cursor.bufferedCount(), 2, 'Cursor did properly buffer');
    });

    it('should get 21st document with next()', async () => {
      const cursor = collection_.find({});

      let doc: any;
      for (let i = 0; i < 21; i++) {
        doc = await cursor.next();
        if (i !== 20) {
          assert.ok(doc, `Doc #${i} is null`);
        }
      }

      assert.ok(doc, 'Doc is not the 21st in the collections');
      assert.strictEqual(cursor['_state'], 1, 'Cursor is not set to the INITIALIZED state');
      assert.strictEqual(cursor.bufferedCount(), 19, 'Cursor did properly buffer');
    });

    it('should return null if there are no more documents with next()', async () => {
      const cursor = collection.find({ _id: '0' });
      const doc = await cursor.next();
      assert.ok(doc, 'Doc is null');
      const next = await cursor.next();
      assert.strictEqual(next, null, 'Cursor did not properly check for more documents');
    });

    it('Provides the next document with a mapping function', async () => {
      const cursor = collection.find({}).map(ageToString);
      const doc = await cursor.next();
      assert.ok(doc, 'Doc is null');
      assert.ok(typeof doc['age'] === 'string', 'Doc did not map properly');
      assert.strictEqual(cursor['_state'], 1, 'Cursor is not set to the INITIALIZED state');
      assert.strictEqual(cursor.bufferedCount(), 2, 'Cursor did not properly read buffer');
    });
  });

  parallel('Symbol.asyncIterator() tests', () => {
    it('should iterate over all documents', async () => {
      const cursor = collection.find({});
      const res: any[] = [];
      for await (const doc of cursor) {
        res.push(doc);
      }
      assert.deepStrictEqual(res.sort(sortById), docs, 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
    });

    it('should iterate over all documents with a mapping function', async () => {
      const cursor = collection.find({}).map(ageToString);
      const res: any[] = [];
      for await (const doc of cursor) {
        res.push(doc);
      }
      assert.deepStrictEqual(res.sort(sortById), docs.map(ageToString), 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
    });

    it('should iterate over all documents with no documents', async () => {
      const cursor = collection.find({ _id: 'Deep Purple' });
      const res: any[] = [];
      for await (const doc of cursor) {
        res.push(doc);
      }
      assert.deepStrictEqual(res, [], 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
    });

    it('should not iterate when called a second time', async () => {
      const cursor = collection.find({});
      const res: any[] = [];
      for await (const doc of cursor) {
        res.push(doc);
      }
      assert.deepStrictEqual(res.sort(sortById), docs, 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
      const res2: any[] = [];
      for await (const doc of cursor) {
        res2.push(doc);
      }
      assert.deepStrictEqual(res2, [], 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
    });

    it('should close cursor after break', async () => {
      const cursor = collection.find({});
      const res: any[] = [];
      // noinspection LoopStatementThatDoesntLoopJS
      for await (const doc of cursor) {
        res.push(doc);
        break;
      }
      assert.deepStrictEqual(res, docs.slice(0, 1), 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
    });
  });

  parallel('toArray() tests', () => {
    it('Gets all documents with toArray()', async () => {
      const cursor = collection.find({});
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortById), docs, 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
    });

    it('Gets all documents with toArray() with a mapping function', async () => {
      const cursor = collection.find({}).map(ageToString);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortById), docs.map(ageToString), 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
    });

    it('Gets all documents with toArray() with no documents', async () => {
      const cursor = collection.find({ _id: 'Iron Maiden' });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [], 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
    });

    it('should return an empty array when called a second time', async () => {
      const cursor = collection.find({});
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortById), docs, 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
      const res2 = await cursor.toArray();
      assert.deepStrictEqual(res2, [], 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
    });
  });

  parallel('forEach() tests', () => {
    it('should iterate over all documents', async () => {
      const cursor = collection.find({});
      const res: any[] = [];
      // noinspection JSDeprecatedSymbols
      await cursor.forEach(doc => { res.push(doc); });
      assert.deepStrictEqual(res.sort(sortById), docs, 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
    });

    it('should iterate over all documents with a mapping function', async () => {
      const cursor = collection.find({}).map(ageToString);
      const res: any[] = [];
      // noinspection JSDeprecatedSymbols
      await cursor.forEach(doc => { res.push(doc); });
      assert.deepStrictEqual(res.sort(sortById), docs.map(ageToString), 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
    });

    it('should iterate over all documents with no documents', async () => {
      const cursor = collection.find({ _id: 'Styx' }, {});
      const res: any[] = [];
      // noinspection JSDeprecatedSymbols
      await cursor.forEach(doc => { res.push(doc); });
      assert.deepStrictEqual(res, [], 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
    });

    it('should not iterate when called a second time', async () => {
      const cursor = collection.find({});
      const res: any[] = [];
      // noinspection JSDeprecatedSymbols
      await cursor.forEach(doc => { res.push(doc); });
      assert.deepStrictEqual(res.sort(sortById), docs, 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
      const res2: any[] = [];
      // noinspection JSDeprecatedSymbols
      await cursor.forEach(doc => { res.push(doc); });
      assert.deepStrictEqual(res2, [], 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
    });

    it('should close cursor after returning false', async () => {
      const cursor = collection.find({});
      const res: any[] = [];
      // noinspection JSDeprecatedSymbols
      await cursor.forEach(doc => {
        res.push(doc);
        return false;
      });
      assert.deepStrictEqual(res, docs.slice(0, 1), 'Cursor did not read all documents');
      assert.strictEqual(cursor['_state'], 2, 'Cursor is not set to the CLOSED state');
      assert.strictEqual(cursor.bufferedCount(), 0, 'Cursor did not properly consume buffer');
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
    });
  });

  parallel('filter tests', () => {
    it('should filter documents', async () => {
      const cursor = collection.find({}).filter({ _id: '1' });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [docs[1]], 'Cursor did not filter documents');
    });

    it('should filter documents with a mapping function', async () => {
      const cursor = collection.find({}).filter({ _id: '1' }).map(ageToString);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [ageToString(docs[1])], 'Cursor did not filter documents');
    });
  });

  parallel('skip/limit tests', () => {
    it('should limit documents', async () => {
      const cursor = collection.find({}).limit(2);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortById), docs.slice(0, 2), 'Cursor did not limit documents');
    });

    it('should limit documents across pages', async () => {
      const cursor = collection_.find({}).limit(50);
      const res = await cursor.toArray();
      assert.strictEqual(res.length, 50, 'Cursor did not limit documents');
    });

    it('should have no limit if limit is set to 0', async () => {
      const cursor = collection_.find({}).limit(0);
      const res = await cursor.toArray();
      assert.strictEqual(res.length, docs_.length, 'Cursor limited documents');
    });

    it('should skip documents', async () => {
      const cursor = collection.find({}).skip(1).sort({ _id: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortById), docs.slice(1), 'Cursor did not skip documents');
    });

    it('should skip documents across pages', async () => {
      const cursor = collection_.find({}).skip(50).sort({ _id: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, docs_.slice(50, 70), 'Cursor did not skip documents');
    });

    it('should limit and skip documents across pages', async () => {
      const cursor = collection_.find({}).skip(50).limit(20).sort({ _id: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, docs_.slice(50, 70), 'Cursor did not limit and skip documents');
    });
  });

  parallel('sort tests', () => {
    it('should sort documents', async () => {
      const cursor = collection.find({}).sort({ _id: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, docs.sort(sortById), 'Cursor did not sort documents');
    });

    it('should sort documents with a mapping function', async () => {
      const cursor = collection.find({}).sort({ age: 1 }).map(ageToString);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, docs.sort(sortByAge).map(ageToString), 'Cursor did not sort documents');
    });
  });

  parallel('projection tests', () => {
    it('should project documents', async () => {
      const cursor = collection.find({}).project({ _id: 0 }).sort({ age: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [{ age: 0 }, { age: 1 }, { age: 2 }], 'Cursor did not project documents');
    });

    it('should project documents with a mapping function', async () => {
      const cursor = collection.find({}).project<{ age: number }>({ _id: 0, age: 1 }).map(ageToString).sort({ age: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [{ age: '0' }, { age: '1' }, { age: '2' }], 'Cursor did not project documents');
    });
  });

  parallel('mapping tests', () => {
    it('should map documents', async () => {
      const cursor = collection.find({}).map(ageToString);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [{ age: '0' }, { age: '1' }, { age: '2' }], 'Cursor did not map documents');
    });

    it('should close cursor and rethrow error if mapping function throws', async () => {
      const cursor = collection.find({}).map(() => { throw new Error('Mapping error'); });
      await assert.rejects(async () => await cursor.toArray(), { message: 'Mapping error' });
      assert.strictEqual(cursor.closed, true, 'Cursor is not closed');
    });
  });

  parallel('sort vector tests', () => {
    before(async () => {
      await collection.insertMany([{ $vector: [1, 1, 1, 1, 1] }, { $vector: [1, 1, 1, 1, 1] }, { $vector: [1, 1, 1, 1, 1] }]);
    });

    after(async () => {
      await collection.deleteMany({ $vector: { $exists: true } });
    });

    it('should return sort vector on only first API call if includeSortVector: true', async () => {
      const cursor = collection_.find({}).sort({ $vector: [1, 1, 1, 1, 1] }).includeSortVector();
      assert.strictEqual(cursor['_sortVector'], undefined);
      assert.strictEqual(cursor['_options'].includeSortVector, true);
      await cursor.hasNext();
      assert.deepStrictEqual(cursor['_sortVector'], [1, 1, 1, 1, 1]);
      assert.strictEqual(cursor['_options'].includeSortVector, false);
      const oldSortVector = cursor['_sortVector'];
      assert.deepStrictEqual(await cursor.getSortVector(), [1, 1, 1, 1, 1]);
      assert.strictEqual(oldSortVector, cursor['_sortVector']);
    });

    it('getSortVector should populate buffer if called first w/ includeSortVector: true', async () => {
      const cursor = collection.find({}).sort({ $vector: [1, 1, 1, 1, 1] }).includeSortVector();
      assert.strictEqual(cursor['_sortVector'], undefined);
      assert.strictEqual(cursor['_options'].includeSortVector, true);
      assert.deepStrictEqual(await cursor.getSortVector(), [1, 1, 1, 1, 1]);
      assert.strictEqual(cursor['_buffer'].length, 3);
    });

    it('should return null in getSortVector if includeSortVector: false', async () => {
      const cursor = collection_.find({}).sort({ $vector: [1, 1, 1, 1, 1] });
      assert.strictEqual(cursor['_sortVector'], undefined);
      assert.strictEqual(cursor['_options'].includeSortVector, undefined);
      await cursor.hasNext();
      assert.deepStrictEqual(cursor['_sortVector'], undefined);
      assert.strictEqual(cursor['_options'].includeSortVector, false);
      assert.deepStrictEqual(await cursor.getSortVector(), null);
      assert.deepStrictEqual(cursor['_sortVector'], undefined);
      assert.strictEqual(cursor['_options'].includeSortVector, false);
    });

    it('should return null in getSortVector if no sort vector', async () => {
      const cursor = collection_.find({}).includeSortVector();
      assert.strictEqual(cursor['_sortVector'], undefined);
      assert.strictEqual(cursor['_options'].includeSortVector, true);
      await cursor.hasNext();
      assert.deepStrictEqual(cursor['_sortVector'], null);
      assert.strictEqual(cursor['_options'].includeSortVector, false);
      assert.strictEqual(await cursor.getSortVector(), null);
      assert.strictEqual(cursor['_sortVector'], null);
      assert.strictEqual(cursor['_options'].includeSortVector, false);
    });
  });

  parallel('misc', () => {
    it('should close cursor and rethrow error if getting documents throws', async () => {
      const cursor = collection.find({});
      cursor['_filter'] = 3 as any;
      await assert.rejects(async () => await cursor.toArray(), DataAPIResponseError);
    });
  });
});
