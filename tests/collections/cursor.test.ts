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

import assert from 'assert';
import { Db } from '@/src/collections/db';
import { FindCursor } from '@/src/collections/cursor';
import { Collection } from '@/src/collections/collection';
import { Client } from '@/src/collections/client';
import { testClient, sampleUsersList, TEST_COLLECTION_NAME } from '@/tests/fixtures';

describe(`StargateMongoose - ${testClient} Connection - collections.cursor`, async () => {
    let astraClient: Client | null;
    let db: Db;
    let collection: Collection;
    const sampleUsers = sampleUsersList;
    before(async function () {
        if (testClient == null) {
            return this.skip();
        }
        astraClient = await testClient.client;
        if (astraClient === null) {
            return this.skip();
        }
        db = astraClient.db();
        const collectionName: string = TEST_COLLECTION_NAME;
        await db.createCollection(collectionName);
        collection = db.collection(collectionName);
        await collection?.deleteMany({});
    });

    beforeEach(async function () {
        await db.createCollection(TEST_COLLECTION_NAME);
        collection = db.collection(TEST_COLLECTION_NAME);
    });

    afterEach(async () => {
    // run drop collection async to save time
        await db?.dropCollection(TEST_COLLECTION_NAME);
    });

    describe('Cursor initialization', () => {
        it('should initialize a Cursor', async () => {
            await collection.insertMany(sampleUsers);
            const cursor = new FindCursor(collection, { username: sampleUsers[0].username });
            assert.strictEqual(cursor.status, 'initialized');
            assert.ok(cursor);
        });
    });

    describe('Cursor operations', () => {
        it('should execute a query', async () => {
            await collection.insertMany(sampleUsers);
            const cursor = new FindCursor(collection, { username: sampleUsers[0].username });
            const res = await cursor.toArray();
            assert.strictEqual(res.length, 1);
        });
        it('should get next document with next()', async () => {
            await collection.insertMany(sampleUsers);
            const cursor = new FindCursor(collection, {});
            const doc = await cursor.next();
            assert.ok(doc);
        });
        it('should execute a limited query', async () => {
            await collection.insertMany(sampleUsers);
            const cursor = new FindCursor(collection, {}, { limit: 3 });
            const res = await cursor.toArray();
            assert.strictEqual(res.length, 3);
            assert.strictEqual(cursor.page.length, 3);
        });
        it('should treat limit 0 as no limit', async () => {
            await collection.insertMany(sampleUsers);
            const cursor = new FindCursor(collection, {}, { limit: 0 });
            const res = await cursor.toArray();
            assert.strictEqual(res.length, 3);
            assert.strictEqual(cursor.page.length, 3);
        });
        it('should handle negative limit', async () => {
            await collection.insertMany(sampleUsers);
            const cursor = new FindCursor(collection, {}, { limit: -2 });
            await assert.rejects(cursor.toArray(), /limit should be greater than `0`/);
        });
        it('should execute a limited query with limit set less than default page size', async () => {
            const docList = Array.from({ length: 20 }, () => ({ 'username': 'id' }));
            docList.forEach((doc, index) => {
                doc.username = doc.username + (index + 1);
            });
            const insertManyResp = await collection.insertMany(docList);
            assert.ok(insertManyResp);
            assert.strictEqual(insertManyResp.insertedCount, 20);
            const cursorWithLimitSet = new FindCursor(collection, {}, { limit: 5 });
            let countWithLimitSet = 0;
            for (let doc = await cursorWithLimitSet.next(); doc != null; doc = await cursorWithLimitSet.next()) {
                countWithLimitSet++;
            }
            assert.strictEqual(countWithLimitSet, 5);
        });
        it('should execute a limited query with limit set equal to default page size', async () => {
            const docList = Array.from({ length: 20 }, () => ({ 'username': 'id' }));
            docList.forEach((doc, index) => {
                doc.username = doc.username + (index + 1);
            });
            const insertManyResp = await collection.insertMany(docList);
            assert.ok(insertManyResp);
            assert.strictEqual(insertManyResp.insertedCount, 20);
            //insert next 20
            const docListNextSet = Array.from({ length: 20 }, () => ({ username: 'id', city: 'nyc' }));
            docListNextSet.forEach((doc, index) => {
                doc.username = doc.username + (index + 21);
            });
            const resNextSet = await collection.insertMany(docListNextSet);
            assert.strictEqual(resNextSet.insertedCount, docListNextSet.length);
            assert.strictEqual(resNextSet.acknowledged, true);
            //test limit and page size
            const cursorWithLimitSet = new FindCursor(collection, {}, { limit: 20 });
            let countWithLimitSet = 0;
            for (let doc = await cursorWithLimitSet.next(); doc != null; doc = await cursorWithLimitSet.next()) {
                countWithLimitSet++;
            }
            assert.strictEqual(countWithLimitSet, 20);
        });
        it('should execute a limited query with limit set greater than available', async () => {
            const docList = Array.from({ length: 20 }, () => ({ 'username': 'id' }));
            docList.forEach((doc, index) => {
                doc.username = doc.username + (index + 1);
            });
            const insertManyResp = await collection.insertMany(docList);
            assert.ok(insertManyResp);
            assert.strictEqual(insertManyResp.insertedCount, 20);
            const cursorWithLimitSet = new FindCursor(collection, {}, { limit: 150 });
            let countWithLimitSet = 0;
            for (let doc = await cursorWithLimitSet.next(); doc != null; doc = await cursorWithLimitSet.next()) {
                countWithLimitSet++;
            }
            assert.strictEqual(countWithLimitSet, 20);
        });
        it('should execute an all query', async () => {
            await collection.insertMany(sampleUsers);
            const cursor = new FindCursor(collection, {});
            const res = await cursor.toArray();
            assert.strictEqual(res.length, sampleUsers.length);
        });
        it('should not execute twice', async () => {
            await collection.insertMany(sampleUsers);
            const cursor = new FindCursor(collection, {});
            assert.strictEqual(cursor.status, 'initialized');
            await cursor.toArray();
            assert.strictEqual(cursor.status, 'executed');
            const count = await cursor.count();
            assert.strictEqual(count, sampleUsers.length);
            //run again
            await cursor.toArray();
            assert.strictEqual(cursor.status, 'executed');
            const count2 = await cursor.count();
            assert.strictEqual(count2, sampleUsers.length);
        });
        it('should iterate over all documents', async () => {
            await collection.insertMany(sampleUsers);
            const cursor = new FindCursor(collection, {});
            let docCount = 0;
            await cursor.forEach(() => {
                docCount++;
            });
            assert.strictEqual(docCount, sampleUsers.length);
        });
        it('should iterate over all documents with a forEach()', async () => {
            await collection.insertMany(sampleUsers);
            const cursor = new FindCursor(collection, {});
            let docCount = 0;
            await cursor.forEach(async () => {
                await Promise.resolve();
                docCount++;
            });
            assert.strictEqual(docCount, sampleUsers.length);
        });
    });

    describe('Cursor noops', () => {
        it('should handle noop: stream', async () => {
            await collection.insertMany(sampleUsers);
            const cursor = new FindCursor(collection, { username: sampleUsers[0].username });
            let error: any;
            try {
                const stream = cursor.stream();
                assert.ok(stream);
            } catch (e) {
                error = e;
            }
            assert.ok(error);
        });
    });
});
