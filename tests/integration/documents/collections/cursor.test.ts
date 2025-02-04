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

import { SomeDoc, vector } from '@/src/documents';
import { describe, initCollectionWithFailingClient, it, parallel } from '@/tests/testlib';
import assert from 'assert';

describe('integration.documents.collections.cursor', { truncate: 'colls:before' }, ({ collection, collection_ }) => {
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
      assert.equal(cursor.state, 'closed');
      await assert.rejects(() => cursor.toArray());
      assert.strictEqual(await cursor.hasNext(), false);
    });

    it('should not copy the mapping function', async () => {
      const cursor = collection.find({}).map(() => 3);
      assert.strictEqual(await cursor.next(), 3);
      const clone = cursor.clone();
      assert.notStrictEqual(await clone.next(), 3);
    });

    it('should rewind cursor', async () => {
      const cursor = collection.find({});
      await cursor.next();
      assert.equal(cursor.state, 'started');
      assert.strictEqual(cursor.buffered(), 2);

      cursor.rewind();
      assert.equal(cursor.state, 'idle');
      assert.strictEqual(cursor.buffered(), 0);
    });

    it('should allow cloned cursor to re-fetch all data', async () => {
      const cursor = collection.find({});
      cursor.close();
      await assert.rejects(() => cursor.toArray());
      assert.deepStrictEqual(cursor.buffered(), 0);

      const clone = cursor.clone();
      const res2 = await clone.toArray();
      assert.deepStrictEqual(res2.sort(sortById), docs);
    });

    it('should allow cloned cursor with mapping function to re-fetch all data without mapping', async () => {
      const cursor = collection.find({}).map(ageToString);
      cursor.close();
      await assert.rejects(() => cursor.toArray());
      assert.deepStrictEqual(cursor.buffered(), 0);

      const clone = cursor.clone();
      const res2 = await clone.toArray();
      assert.deepStrictEqual(res2.sort(sortById), docs);
    });

    it('should allow rewind-ed cursor to re-fetch all data', async () => {
      const cursor = collection.find({});
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortById), docs);
      assert.deepStrictEqual(cursor.buffered(), 0);

      cursor.rewind();
      const res2 = await cursor.toArray();
      assert.deepStrictEqual(res2.sort(sortById), docs);
    });

    it('should allow rewind-ed cursor with mapping function to re-fetch all data with mapping', async () => {
      const cursor = collection.find({}).map(ageToString);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortById), docs.map(ageToString));
      assert.deepStrictEqual(cursor.buffered(), 0);

      cursor.rewind();
      const res2 = await cursor.toArray();
      assert.deepStrictEqual(res2.sort(sortById), docs.map(ageToString));
    });
  });

  parallel('cursor building', () => {
    it('should immutably set a filter', async () => {
      const filter = { _id: '1' };
      const cursor1 = collection.find(filter);
      assert.deepStrictEqual(await cursor1.next(), docs[1]);
      filter._id = '2';
      cursor1.rewind();
      assert.deepStrictEqual(await cursor1.next(), docs[1]);
      assert.throws(() => cursor1.filter(filter));
      cursor1.rewind();
      const cursor2 = cursor1.filter(filter);
      assert.deepStrictEqual(await cursor1.next(), docs[1]);
      assert.deepStrictEqual(await cursor2.next(), docs[2]);
    });

    it('should immutably set a projection', async () => {
      const projection = { _id: 0 } as SomeDoc;
      const cursor1 = collection.find({ _id: '0' }, { projection });
      assert.deepStrictEqual(await cursor1.next(), { age: 0 });
      projection._id = 1;
      projection.age = 0;
      cursor1.rewind();
      assert.deepStrictEqual(await cursor1.next(), { age: 0 });
      assert.throws(() => cursor1.project(projection));
      cursor1.rewind();
      const cursor2 = cursor1.project(projection);
      assert.deepStrictEqual(await cursor1.next(), { age: 0 });
      assert.deepStrictEqual(await cursor2.next(), { _id: '0' });
    });

    it('should immutably set a sort', async () => {
      const sort = { age: 1 } as SomeDoc;
      const cursor1 = collection.find({}, { sort });
      assert.deepStrictEqual(await cursor1.next(), docs[0]);
      sort.age = -1;
      cursor1.rewind();
      assert.deepStrictEqual(await cursor1.next(), docs[0]);
      assert.throws(() => cursor1.sort(sort));
      cursor1.rewind();
      const cursor2 = cursor1.sort(sort);
      assert.deepStrictEqual(await cursor1.next(), docs[0]);
      assert.deepStrictEqual(await cursor2.next(), docs[2]);
    });

    it('should immutably set a limit', async () => {
      const cursor1 = collection.find({}, { limit: 1 });
      assert.deepStrictEqual((await cursor1.toArray()).length, 1);
      assert.throws(() => cursor1.limit(2));
      cursor1.rewind();
      const cursor2 = cursor1.limit(2);
      assert.deepStrictEqual((await cursor1.toArray()).length, 1);
      assert.deepStrictEqual((await cursor2.toArray()).length, 2);
    });

    it('should immutably set a skip', async () => {
      const cursor1 = collection.find({}, { skip: 1, sort: { age: 1 } });
      assert.deepStrictEqual((await cursor1.toArray()).length, 2);
      assert.throws(() => cursor1.skip(2));
      cursor1.rewind();
      const cursor2 = cursor1.skip(2);
      assert.deepStrictEqual((await cursor1.toArray()).length, 2);
      assert.deepStrictEqual((await cursor2.toArray()).length, 1);
    });

    it('should immutably set a mapping function', async () => {
      const cursor1 = collection.find({}).map(ageToString);
      assert.deepStrictEqual(await cursor1.next(), { age: '0' });
      assert.throws(() => cursor1.map(doc => ({ age: `${doc.age}!` })));
      cursor1.rewind();
      const cursor2 = cursor1.map(doc => ({ age: `${doc.age}!` }));
      assert.deepStrictEqual(await cursor1.next(), { age: '0' });
      assert.deepStrictEqual(await cursor2.next(), { age: '0!' });
    });
  });

  parallel('hasNext() tests', () => {
    it('should test if there are more documents with hasNext()', async () => {
      const cursor = collection.find({});
      const next = await cursor.next();
      assert.ok(next, 'Cursor did not read next');
      const hasNext = await cursor.hasNext();
      assert.strictEqual(hasNext, true);
    });

    it('should test if there are more documents with hasNext() with no buffer set', async () => {
      const cursor = collection.find({});
      const hasNext = await cursor.hasNext();
      assert.strictEqual(hasNext, true);
    });

    it('should test if there are no more documents with hasNext()', async () => {
      const cursor = collection.find({});
      for (let i = 0; i < 3; i++) {
        const doc = await cursor.next();
        assert.ok(doc, `Doc #${i} is null`);
      }
      const hasNext = await cursor.hasNext();
      assert.strictEqual(hasNext, false);
    });
  });

  parallel('readBufferedDocuments() tests', () => {
    it('should read all raw buffered documents', async () => {
      const cursor = collection.find({});
      await cursor.hasNext();
      assert.equal(cursor.state, 'idle');
      assert.strictEqual(cursor.buffered(), 3);

      const raw = cursor.consumeBuffer();
      assert.strictEqual(raw.length, 3);
      assert.strictEqual(cursor.buffered(), 0);
      assert.deepStrictEqual(raw.sort(sortById), docs);
    });

    it('should read all raw buffered documents with a max', async () => {
      const cursor = collection.find({});
      await cursor.hasNext();
      assert.equal(cursor.state, 'idle');
      assert.strictEqual(cursor.buffered(), 3);
      const raw = cursor.consumeBuffer(2);
      assert.strictEqual(raw.length, 2);
      assert.strictEqual(cursor.buffered(), 1);
      assert.deepStrictEqual(raw.sort(sortById), docs.sort(sortById).slice(0, 2));
    });

    it('should read all raw buffered documents even with transformation', async () => {
      const cursor = collection.find({}).map(() => ({ _id: 0 }));
      await cursor.hasNext();
      assert.equal(cursor.state, 'idle');
      assert.strictEqual(cursor.buffered(), 3);

      const raw = cursor.consumeBuffer();
      assert.strictEqual(raw.length, 3);
      assert.strictEqual(cursor.buffered(), 0);
      assert.deepStrictEqual(raw.sort(sortById), docs);
    });
  });

  parallel('next() tests', () => {
    it('should get next document with next()', async () => {
      const cursor = collection.find({});
      const doc = await cursor.next();
      assert.deepStrictEqual(doc, docs[0]);
      assert.equal(cursor.state, 'started');
      assert.strictEqual(cursor.buffered(), 2);
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
      assert.equal(cursor.state, 'started');
      assert.strictEqual(cursor.buffered(), 19);
    });

    it('should return null if there are no more documents with next()', async () => {
      const cursor = collection.find({ _id: '0' });
      const doc = await cursor.next();
      assert.ok(doc, 'Doc is null');
      const next = await cursor.next();
      assert.strictEqual(next, null);
    });

    it('Provides the next document with a mapping function', async () => {
      const cursor = collection.find({}).map(ageToString);
      const doc = await cursor.next();
      assert.ok(doc, 'Doc is null');
      assert.ok(typeof doc['age'] === 'string');
      assert.equal(cursor.state, 'started');
      assert.strictEqual(cursor.buffered(), 2);
    });
  });

  parallel('Symbol.asyncIterator() tests', () => {
    it('should iterate over all documents', async () => {
      const cursor = collection.find({});
      const res: any[] = [];
      for await (const doc of cursor) {
        res.push(doc);
      }
      assert.deepStrictEqual(res.sort(sortById), docs);
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
    });

    it('should iterate over all documents with a mapping function', async () => {
      const cursor = collection.find({}).map(ageToString);
      const res: any[] = [];
      for await (const doc of cursor) {
        res.push(doc);
      }
      assert.deepStrictEqual(res.sort(sortById), docs.map(ageToString));
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
    });

    it('should iterate over all documents with no documents', async () => {
      const cursor = collection.find({ _id: 'Deep Purple' });
      const res: any[] = [];
      for await (const doc of cursor) {
        res.push(doc);
      }
      assert.deepStrictEqual(res, []);
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
    });

    it('should not iterate when called a second time', async () => {
      const cursor = collection.find({});
      const res: any[] = [];
      for await (const doc of cursor) {
        res.push(doc);
      }
      assert.deepStrictEqual(res.sort(sortById), docs);
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
      await assert.rejects(async () => {
        for await (const _ of cursor) { /* ... */ }
      });
      assert.equal(cursor.state, 'closed');
    });

    it('should close cursor after break', async () => {
      const cursor = collection.find({});
      const res: any[] = [];
      // noinspection LoopStatementThatDoesntLoopJS
      for await (const doc of cursor) {
        res.push(doc);
        break;
      }
      assert.deepStrictEqual(res, docs.slice(0, 1));
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
    });
  });

  parallel('toArray() tests', () => {
    it('Gets all documents with toArray()', async () => {
      const cursor = collection.find({});
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortById), docs);
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
    });

    it('Gets all documents with toArray() with a mapping function', async () => {
      const cursor = collection.find({}).map(ageToString);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortById), docs.map(ageToString));
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
    });

    it('Gets all documents with toArray() with no documents', async () => {
      const cursor = collection.find({ _id: 'Iron Maiden' });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, []);
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
    });

    it('should throw an error when toArray() called a second time', async () => {
      const cursor = collection.find({});
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortById), docs);
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
      await assert.rejects(() => cursor.toArray());
      assert.equal(cursor.state, 'closed');
    });
  });

  parallel('forEach() tests', () => {
    it('should iterate over all documents', async () => {
      const cursor = collection.find({});
      const res: any[] = [];
      // noinspection JSDeprecatedSymbols
      await cursor.forEach(doc => { res.push(doc); });
      assert.deepStrictEqual(res.sort(sortById), docs);
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
    });

    it('should iterate over all documents with a mapping function', async () => {
      const cursor = collection.find({}).map(ageToString);
      const res: any[] = [];
      // noinspection JSDeprecatedSymbols
      await cursor.forEach(doc => { res.push(doc); });
      assert.deepStrictEqual(res.sort(sortById), docs.map(ageToString));
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
    });

    it('should iterate over all documents with no documents', async () => {
      const cursor = collection.find({ _id: 'Styx' }, {});
      const res: any[] = [];
      await cursor.forEach(doc => { res.push(doc); });
      assert.deepStrictEqual(res, []);
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
    });

    it('should not iterate when called a second time', async () => {
      const cursor = collection.find({});
      const res: any[] = [];
      await cursor.forEach(doc => { res.push(doc); });
      assert.deepStrictEqual(res.sort(sortById), docs);
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
      await assert.rejects(() => cursor.forEach(_ => {}));
      assert.equal(cursor.state, 'closed');
    });

    it('should close cursor after returning false', async () => {
      const cursor = collection.find({});
      const res: any[] = [];
      await cursor.forEach(doc => {
        res.push(doc);
        return false;
      });
      assert.deepStrictEqual(res, docs.slice(0, 1));
      assert.equal(cursor.state, 'closed');
      assert.strictEqual(cursor.buffered(), 0);
      assert.equal(cursor.state, 'closed');
    });
  });

  parallel('filter tests', () => {
    it('should filter documents', async () => {
      const cursor = collection.find({}).filter({ _id: '1' });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [docs[1]]);
    });

    it('should filter documents with a mapping function', async () => {
      const cursor = collection.find({}).filter({ _id: '1' }).map(ageToString);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [ageToString(docs[1])]);
    });
  });

  parallel('skip/limit tests', () => {
    it('should limit documents', async () => {
      const cursor = collection.find({}).limit(2);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortById), docs.slice(0, 2));
    });

    it('should limit documents across pages', async () => {
      const cursor = collection_.find({}).limit(50);
      const res = await cursor.toArray();
      assert.strictEqual(res.length, 50);
    });

    it('should have no limit if limit is set to 0', async () => {
      const cursor = collection_.find({}).limit(0);
      const res = await cursor.toArray();
      assert.strictEqual(res.length, docs_.length, 'Cursor limited documents');
    });

    it('should skip documents', async () => {
      const cursor = collection.find({}).skip(1).sort({ _id: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res.sort(sortById), docs.slice(1));
    });

    it('should skip documents across pages', async () => {
      const cursor = collection_.find({}).skip(50).sort({ _id: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, docs_.slice(50, 70));
    });

    it('should limit and skip documents across pages', async () => {
      const cursor = collection_.find({}).skip(50).limit(20).sort({ _id: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, docs_.slice(50, 70));
    });
  });

  parallel('sort tests', () => {
    it('should sort documents', async () => {
      const cursor = collection.find({}).sort({ _id: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, docs.sort(sortById));
    });

    it('should sort documents with a mapping function', async () => {
      const cursor = collection.find({}).sort({ age: 1 }).map(ageToString);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, docs.sort(sortByAge).map(ageToString));
    });
  });

  parallel('projection tests', () => {
    it('should project documents', async () => {
      const cursor = collection.find({}).project({ _id: 0 }).sort({ age: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [{ age: 0 }, { age: 1 }, { age: 2 }]);
    });

    it('should project documents with a mapping function', async () => {
      const cursor = collection.find({}).project<{ age: number }>({ _id: 0, age: 1 }).map(ageToString).sort({ age: 1 });
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [{ age: '0' }, { age: '1' }, { age: '2' }]);
    });
  });

  parallel('mapping tests', () => {
    it('should map documents', async () => {
      const cursor = collection.find({}).map(ageToString);
      const res = await cursor.toArray();
      assert.deepStrictEqual(res, [{ age: '0' }, { age: '1' }, { age: '2' }]);
    });

    it('should close cursor and rethrow error if mapping function throws', async () => {
      const cursor = collection.find({}).map(() => { throw new Error('Mapping error'); });
      await assert.rejects(async () => await cursor.toArray(), { message: 'Mapping error' });
      assert.equal(cursor.state, 'closed');
    });
  });

  parallel('sort vector tests', () => {
    before(async () => {
      await collection.insertMany([{ $vector: vector([1, 1, 1, 1, 1]) }, { $vector: [1, 1, 1, 1, 1] }, { $vector: [1, 1, 1, 1, 1] }]);
    });

    after(async () => {
      await collection.deleteMany({ $vector: { $exists: true } });
    });

    it('should return sort vector on only first API call if includeSortVector: true', async () => {
      const cursor = collection_.find({}).sort({ $vector: [1, 1, 1, 1, 1] }).includeSortVector();
      const start1 = performance.now();
      assert.deepStrictEqual((await cursor.getSortVector())?.asArray(), [1, 1, 1, 1, 1]);
      assert.ok(performance.now() - start1 > 5);
      const start2 = performance.now();
      assert.deepStrictEqual((await cursor.getSortVector())?.asArray(), [1, 1, 1, 1, 1]);
      assert.ok(performance.now() - start2 < 2);
    });

    it('getSortVector should populate buffer if called first w/ includeSortVector: true', async () => {
      const cursor = collection.find({}).sort({ $vector: [1, 1, 1, 1, 1] }).includeSortVector();
      assert.deepStrictEqual((await cursor.getSortVector())?.asArray(), [1, 1, 1, 1, 1]);
      assert.strictEqual(cursor.consumeBuffer().length, 3);
    });

    it('should return null in getSortVector if includeSortVector: false', async () => {
      const cursor = collection_.find({}).sort({ $vector: [1, 1, 1, 1, 1] });
      await cursor.hasNext();
      assert.deepStrictEqual(await cursor.getSortVector(), null);
    });

    it('should return null in getSortVector if no sort vector', async () => {
      const cursor = collection_.find({}).includeSortVector();
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
