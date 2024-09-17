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

import { DataAPIError, DataAPITimeoutError, InsertManyError, ObjectId, UUID } from '@/src/data-api';
import { initCollectionWithFailingClient, it, parallel } from '@/tests/testlib';
import assert from 'assert';

parallel('integration.data-api.collection.insert-many', { truncateColls: 'default:before' }, ({ collection }) => {
  it('should insertMany documents', async () => {
    const docs = [{ name: 'Inis Mona' }, { name: 'Helvetios' }, { name: 'Epona' }];
    const res = await collection.insertMany(docs);
    assert.strictEqual(res.insertedCount, docs.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docs.length);

    res.insertedIds.forEach((id) => {
      assert.ok(typeof id as any === 'string');
      assert.doesNotThrow(() => new UUID(<string>id));
    });
  });

  it('should insertMany many documents', async () => {
    const docs = Array.from({ length: 1000 }, (_, i) => ({ name: `Player ${i}` }));
    const res = await collection.insertMany(docs);
    assert.strictEqual(res.insertedCount, docs.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docs.length);

    res.insertedIds.forEach((id) => {
      assert.ok(typeof id as any === 'string');
      assert.doesNotThrow(() => new UUID(<string>id));
    });
  });

  it('should insertMany 0 documents', async () => {
    const res = await collection.insertMany([]);
    assert.deepStrictEqual(res, { insertedCount: 0, insertedIds: [] });
  });

  it('should insertMany 0 documents ordered', async () => {
    const res = await collection.insertMany([], { ordered: true });
    assert.deepStrictEqual(res, { insertedCount: 0, insertedIds: [] });
  });

  it('should insertMany documents with ids', async () => {
    const docs = [{ name: 'Inis Mona', _id: UUID.v7().toString() }, { name: 'Helvetios', _id: UUID.v7().toString() }, { name: 'Epona', _id: UUID.v7().toString() }];
    const res = await collection.insertMany(docs);
    assert.strictEqual(res.insertedCount, docs.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docs.length);
    assert.deepStrictEqual(res.insertedIds.sort((a, b) => <any>a - <any>b), docs.map((doc) => doc._id));
  });

  it('should insertMany documents with UUIDs', async () => {
    const docs = [{ name: 'Inis Mona', _id: UUID.v7() }, { name: 'Helvetios', _id: UUID.v7() }, { name: 'Epona', _id: UUID.v7() }];
    const res = await collection.insertMany(docs);
    assert.strictEqual(res.insertedCount, docs.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docs.length);
    assert.deepStrictEqual(res.insertedIds.map((id) => (<UUID>id).toString()).sort(), docs.map(doc => doc._id.toString()).sort());
  });

  it('should insertMany documents with ObjectIds', async () => {
    const docs = [{ name: 'Inis Mona', _id: new ObjectId() }, { name: 'Helvetios', _id: new ObjectId() }, { name: 'Epona', _id: new ObjectId() }];
    const res = await collection.insertMany(docs);
    assert.strictEqual(res.insertedCount, docs.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docs.length);
    assert.deepStrictEqual(res.insertedIds.map((id) => (<ObjectId>id).toString()).sort(), docs.map(doc => doc._id.toString()).sort());
  });

  it('should insertMany documents with a mix of ids', async () => {
    const docs = [{ name: 'Inis Mona', _id: new ObjectId() }, { name: 'Helvetios', _id: UUID.v4() }, { name: 'Epona' }];
    const res = await collection.insertMany(docs);
    assert.strictEqual(res.insertedCount, docs.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docs.length);
  });

  it('should insertOne with vectors', async (key) => {
    const res = await collection.insertMany([
      { name: 'a', key },
      { name: 'b', key },
      { name: 'c', key },
    ], {
      vectors: [
        [1, 1, 1, 1, 1],
        undefined,
        [1, 1, 1, 1, 1],
      ],
    });
    assert.ok(res);

    const res1 = await collection.findOne({ name: 'a', key }, { projection: { $vector: 1 } });
    assert.deepStrictEqual(res1?.$vector, [1, 1, 1, 1, 1]);

    const res2 = await collection.findOne({ name: 'b', key });
    assert.strictEqual(res2?.$vector, undefined);
  });

  it('should error out when inserting with mis-matched vectors', async () => {
    await assert.rejects(async () => {
      await collection.insertMany([
        { name: 'a' },
        { name: 'b' },
        { name: 'c' },
      ], {
        vectors: [
          [1, 1, 1, 1, 1],
          undefined,
          [1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1],
        ],
      });
    }, Error);
  });

  it('should error out when inserting with mis-matched vectorize', async () => {
    await assert.rejects(async () => {
      await collection.insertMany([
        { name: 'a' },
        { name: 'b' },
        { name: 'c' },
      ], {
        vectorize: [
          'Arch Enemy is a Swedish melodic death metal band, originally a supergroup from Halmstad, formed in 1995.',
          'Equilibrium is a German symphonic metal band',
          undefined,
          'Green Day is an American rock band formed in 1986 by lead vocalist and guitarist Billie Joe Armstrong and bassist Mike Dirnt',
        ],
      });
    }, Error);
  });

  it('should fail when inserting with both vector and vectorize', async () => {
    await assert.rejects(async () => {
      await collection.insertMany([
        { name: 'a' },
        { name: 'b' },
        { name: 'c' },
      ], {
        vectors: [[1, 1, 1, 1, 1]],
        vectorize: ['Hello there.'],
      });
    }, Error);
  });

  it('should insertMany documents ordered', async () => {
    const docs = [{ name: 'Inis Mona', _id: UUID.v7().toString() }, { name: 'Helvetios', _id: UUID.v7().toString() }, { name: 'Epona', _id: UUID.v7().toString() }];
    const res = await collection.insertMany(docs, { ordered: true });
    assert.strictEqual(res.insertedCount, docs.length);
    assert.strictEqual(Object.keys(res.insertedIds).length, docs.length);
    assert.deepStrictEqual(res.insertedIds, docs.map((doc) => doc._id));
  });

  it('should error out when one of the docs in insertMany is invalid with ordered true', async (key) => {
    const docs = Array.from({ length: 20 }, (_, i) => ({ _id: key + i }));
    docs[10] = docs[9];
    let error: unknown;
    try {
      await collection.insertMany(docs, { ordered: true });
      assert.fail('Should have thrown an error');
    } catch (e) {
      error = e;
    }
    assert.ok(error);
    assert.ok(error instanceof InsertManyError);
    assert.strictEqual(error.errorDescriptors[0].errorCode, 'DOCUMENT_ALREADY_EXISTS');
    assert.strictEqual(error.partialResult.insertedCount, 10);
    // assert.strictEqual(error.failedCount, 10);
    docs.slice(0, 10).forEach((doc, index) => {
      assert.strictEqual(error.partialResult.insertedIds[index], doc._id);
    });
  });

  it('should error out when one of the docs in insertMany is invalid with ordered false', async (key) => {
    const docs = Array.from({ length: 20 }, (_, i) => ({ _id: key + i }));
    docs[10] = docs[9];
    let error: unknown;
    try {
      await collection.insertMany(docs, { ordered: false });
    } catch (e) {
      error = e;
    }
    assert.ok(error);
    assert.ok(error instanceof InsertManyError);
    assert.strictEqual(error.errorDescriptors[0].errorCode, 'DOCUMENT_ALREADY_EXISTS');
    assert.strictEqual(error.partialResult.insertedCount, 19);
    // assert.strictEqual(error.failedCount, 1);
    docs.slice(0, 9).concat(docs.slice(10)).forEach((doc) => {
      assert.ok(error.partialResult.insertedIds.includes(doc._id));
    });
  });

  it('fails fast on hard errors ordered', async () => {
    const collection = initCollectionWithFailingClient();
    try {
      await collection.insertMany([{ name: 'Ignea' }], { ordered: true });
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.ok(!(e instanceof DataAPIError));
      assert.strictEqual(e.message, 'test');
    }
  });

  it('fails fast on hard errors unordered', async () => {
    const collection = initCollectionWithFailingClient();
    try {
      await collection.insertMany([{ name: 'Ignea' }], { ordered: false });
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.ok(!(e instanceof DataAPIError));
      assert.strictEqual(e.message, 'test');
    }
  });

  it('times out properly', async (key) => {
    try {
      const docs = Array.from({ length: 1000 }, () => ({ key }));
      await collection.insertMany(docs, { ordered: true, maxTimeMS: 500, chunkSize: 10 });
      assert.fail('Expected an error');
    } catch (e) {
      assert.ok(e instanceof DataAPITimeoutError);
      assert.strictEqual(e.timeout, 500);
      const found = await collection.find({ key }).toArray();
      assert.ok(found.length > 0);
      assert.ok(found.length < 1000);
    }
  });
});
