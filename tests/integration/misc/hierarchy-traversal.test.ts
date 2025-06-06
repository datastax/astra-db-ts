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

import { Cfg, describe, it, parallel } from '@/tests/testlib/index.js';
import assert from 'assert';

parallel('(ASTRA) integration.misc.hierarchy-traversal', ({ client, db }) => {
  let id: string, region: string;

  before(() => {
    const idAndRegion = Cfg.DbUrl
      .split('.')[0]
      .split('https://')[1]
      .split('-');

    id = idAndRegion.slice(0, 5).join('-');
    region = idAndRegion.slice(5).join('-');
  });

  describe('db->admin->db', () => {
    it('is a noop', async () => {
      const db1 = db.admin().db();
      const db2 = db.admin().db().admin().db();
      assert.strictEqual(db, db1);
      assert.strictEqual(db, db2);
    });

    it('works with endpoint', async () => {
      const collections = await db.listCollections();
      assert.ok(Array.isArray(collections));

      const db1 = db.admin().db();
      const collections1 = await db1.listCollections();
      assert.ok(Array.isArray(collections1));

      const db2 = db.admin().db().admin().db();
      const collections2 = await db2.listCollections();
      assert.ok(Array.isArray(collections2));

      assert.deepStrictEqual(collections, collections1);
      assert.deepStrictEqual(collections, collections2);

      assert.doesNotThrow(async () => await db1.collection(Cfg.DefaultCollectionName).findOne({}));
      assert.doesNotThrow(async () => await db2.collection(Cfg.DefaultCollectionName).findOne({}));
    });
  });

  describe('(NOT-DEV) client->admin->dbAdmin <-> client->db->admin', () => {
    it('is essentially a noop', async () => {
      const dbAdmin1 = client.admin().dbAdmin(Cfg.DbUrl);
      const dbAdmin2 = client.db(Cfg.DbUrl).admin();
      assert.strictEqual(dbAdmin1.db().id, dbAdmin2.db().id);
      assert.strictEqual(dbAdmin1.db().keyspace, dbAdmin2.db().keyspace);
    });

    it('works with endpoint', async () => {
      const dbAdmin1 = client.admin().dbAdmin(Cfg.DbUrl);
      const dbAdmin2 = client.db(Cfg.DbUrl).admin();
      const info1 = await dbAdmin1.info();
      const info2 = await dbAdmin2.info();
      assert.deepStrictEqual(info1.name, info2.name);
      assert.deepStrictEqual(info1.id, info2.id);
    });

    it('works with id + region & endpoint', async () => {
      const dbAdmin1 = client.admin().dbAdmin(id, region);
      const dbAdmin2 = client.db(Cfg.DbUrl).admin();
      const info1 = await dbAdmin1.info();
      const info2 = await dbAdmin2.info();
      assert.deepStrictEqual(info1.name, info2.name);
      assert.deepStrictEqual(info1.id, info2.id);
    });
  });

  describe('(NOT-DEV) client->admin->dbAdmin->db <-> client->db->admin->db', () => {
    it('is essentially a noop', async () => {
      const db1 = client.admin().dbAdmin(Cfg.DbUrl).db();
      const db2 = client.db(Cfg.DbUrl).admin().db();
      assert.strictEqual(db1.id, db2.id);
      assert.strictEqual(db1.keyspace, db2.keyspace);

      await assert.doesNotReject(async () => await db1.collection(Cfg.DefaultCollectionName).findOne({}));
      await assert.doesNotReject(async () => await db1.collection(Cfg.DefaultCollectionName).findOne({}));
    });

    it('works with endpoint', async () => {
      const db1 = client.admin().dbAdmin(Cfg.DbUrl).db();
      const collections1 = await db1.listCollections();
      assert.ok(Array.isArray(collections1));

      const db2 = client.db(Cfg.DbUrl).admin().db();
      const collections2 = await db2.listCollections();
      assert.ok(Array.isArray(collections2));

      assert.deepStrictEqual(collections1, collections2);

      await assert.doesNotReject(async () => await db1.collection(Cfg.DefaultCollectionName).findOne({}));
      await assert.doesNotReject(async () => await db2.collection(Cfg.DefaultCollectionName).findOne({}));
    });

    it('works with id + region & endpoint', async () => {
      const db1 = client.admin().dbAdmin(id, region).db();
      const collections1 = await db1.listCollections();
      assert.ok(Array.isArray(collections1));

      const db2 = client.db(Cfg.DbUrl).admin().db();
      const collections2 = await db2.listCollections();
      assert.ok(Array.isArray(collections2));

      assert.deepStrictEqual(collections1, collections2);
    });
  });
});
