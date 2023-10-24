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
import { Client } from '@/src/collections/client';
import { parseUri, createNamespace } from '@/src/collections/utils';
import { testClient, TEST_COLLECTION_NAME } from '@/tests/fixtures';
import { randAlphaNumeric } from '@ngneat/falso';
import {HTTPClient} from '@/src/client';

describe('StargateMongoose - collections.Db', async () => {
    let astraClient: Client | null;
    let dbUri: string;
    let isAstra: boolean;
    let httpClient: HTTPClient;
    before(async function () {
        if (testClient == null) {
            return this.skip();
        }
        astraClient = await testClient.client;
        if (astraClient === null) {
            return this.skip();
        }
        dbUri = testClient.uri;
        isAstra = testClient.isAstra;
        httpClient = astraClient.httpClient;
    });
    afterEach(async () => {
        const db = astraClient?.db();
        // run drop collection async to save time
        await db?.dropCollection(TEST_COLLECTION_NAME);
    });

    describe('Db initialization', () => {
        it('should initialize a Db', () => {
            const db = new Db(httpClient, 'test-db');
            assert.ok(db);
        });
        it('should not initialize a Db without a name', () => {
            let error: any;
            try {
                // @ts-ignore - intentionally passing undefined for testing purposes
                const db = new Db(httpClient);
                assert.ok(db);
            } catch (e) {
                error = e;
            }
            assert.ok(error);
        });
    });

    describe('Db collection operations', () => {
        it('should initialize a Collection', () => {
            const db = new Db(httpClient, 'test-db');
            const collection = db.collection('test-collection');
            assert.ok(collection);
        });
        it('should not initialize a Collection without a name', () => {
            let error: any;
            try {
                const db = new Db(httpClient, 'test-db');
                // @ts-ignore - intentionally passing undefined for testing purposes
                const collection = db.collection();
                assert.ok(collection);
            } catch (e) {
                error = e;
            }
            assert.ok(error);
        });
        it('should create a Collection', async () => {
            const collectionName = TEST_COLLECTION_NAME;
            const db = new Db(httpClient, parseUri(dbUri).keyspaceName);
            const res = await db.createCollection(collectionName);
            assert.ok(res);
            assert.strictEqual(res.status.ok, 1);
            const res2 = await db.createCollection(collectionName);
            assert.ok(res2);
            assert.strictEqual(res2.status.ok, 1);
        });

        it('should drop a Collection', async () => {
            const db = new Db(httpClient, parseUri(dbUri).keyspaceName);
            const suffix = randAlphaNumeric({ length: 4 }).join('');
            await db.createCollection(`test_db_collection_${suffix}`);
            const res = await db.dropCollection(`test_db_collection_${suffix}`);
            assert.strictEqual(res.status?.ok, 1);
            assert.strictEqual(res.errors, undefined);
        });
    });

    describe('dropDatabase', function (this: Mocha.Suite) {
        const suite = this;
        after(async () => {
            if (isAstra) {
                return;
            }
            const keyspaceName = parseUri(dbUri).keyspaceName;
            await createNamespace(httpClient, keyspaceName);
        });
        it('should drop the underlying database (AKA namespace)', async () => {
            if (isAstra) {
                suite.ctx.skip();
            }
            const keyspaceName = parseUri(dbUri).keyspaceName;
            const db = new Db(httpClient, keyspaceName);
            const suffix = randAlphaNumeric({ length: 4 }).join('');
            await db.createCollection(`test_db_collection_${suffix}`);
            const res = await db.dropDatabase();
            assert.strictEqual(res.status?.ok, 1);

            try {
                await db.createCollection(`test_db_collection_${suffix}`);
                assert.ok(false);
            } catch (err: any) {
                assert.strictEqual(err.errors.length, 1);
                assert.strictEqual(
                    err.errors[0].message,
                    'INVALID_ARGUMENT: Keyspace \'' + keyspaceName + '\' doesn\'t exist'
                );
            }
        });
    });

    describe('createDatabase', function (this: Mocha.Suite) {
        const suite = this;
        after(async () => {
            if (isAstra) {
                return;
            }
            const keyspaceName = parseUri(dbUri).keyspaceName;
            await createNamespace(httpClient, keyspaceName);
        });

        it('should create the underlying database (AKA namespace)', async () => {
            if (isAstra) {
                suite.ctx.skip();
            }
            const keyspaceName = parseUri(dbUri).keyspaceName;
            const db = new Db(httpClient, keyspaceName);
            const suffix = randAlphaNumeric({ length: 4 }).join('');

            await db.dropDatabase().catch(err => {
                if (err.errors[0].exceptionClass === 'NotFoundException') {
                    return;
                }

                throw err;
            });

            try {
                await db.createCollection(`test_db_collection_${suffix}`);
                assert.ok(false);
            } catch (err: any) {
                assert.strictEqual(err.errors.length, 1);
                assert.strictEqual(
                    err.errors[0].message,
                    'INVALID_ARGUMENT: Keyspace \'' + keyspaceName + '\' doesn\'t exist'
                );
            }

            const res = await db.createDatabase();
            assert.strictEqual(res.status?.ok, 1);

            await db.createCollection(`test_db_collection_${suffix}`);
        });
    });
});