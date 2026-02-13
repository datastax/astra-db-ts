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

import assert from 'assert';
import { Cfg, describe, initTestObjects, it, parallel } from '@/tests/testlib/index.js';
import { DataAPIResponseError } from '@/src/documents/index.js';
import { DataAPIClient } from '@/src/client/index.js';
import { DEFAULT_DATA_API_PATHS, DEFAULT_KEYSPACE } from '@/src/lib/api/constants.js';

parallel('integration.db.db', { drop: 'colls:after' }, ({ db }) => {
  describe('(LONG) createCollection', () => {
    it('should create a collection', async () => {
      const res = await db.createCollection('coll_1c', { indexing: { deny: ['*'] } });
      assert.ok(res);
      assert.strictEqual(res.name, 'coll_1c');
      assert.strictEqual(res.keyspace, DEFAULT_KEYSPACE);
    });

    it('should create a collection in another keyspace', async () => {
      const res = await db.createCollection('coll_2c', { keyspace: Cfg.OtherKeyspace, indexing: { deny: ['*'] } });
      assert.ok(res);
      assert.strictEqual(res.name, 'coll_2c');
      assert.strictEqual(res.keyspace, Cfg.OtherKeyspace);
    });

    it('should create collections idempotently', async () => {
      const res = await db.createCollection('coll_4c', { indexing: { deny: ['*'] } });
      assert.ok(res);
      assert.strictEqual(res.name, 'coll_4c');
      const res2 = await db.createCollection('coll_4c', { indexing: { deny: ['*'] } });
      assert.ok(res2);
      assert.strictEqual(res2.name, 'coll_4c');
    });

    it('should create collections with same options idempotently', async () => {
      const res = await db.createCollection('coll_5c', { indexing: { deny: ['*'] } });
      assert.ok(res);
      assert.strictEqual(res.name, 'coll_5c');
      assert.strictEqual(res.keyspace, DEFAULT_KEYSPACE);
      const res2 = await db.createCollection('coll_5c', { indexing: { deny: ['*'] } });
      assert.ok(res2);
      assert.strictEqual(res2.name, 'coll_5c');
      assert.strictEqual(res2.keyspace, DEFAULT_KEYSPACE);
    });

    it('should fail creating collections with different options', async () => {
      const res = await db.createCollection('coll_6c', { indexing: { deny: ['*'] }, defaultId: { type: 'uuid' }  });
      assert.ok(res);
      assert.strictEqual(res.name, 'coll_6c');
      assert.strictEqual(res.keyspace, DEFAULT_KEYSPACE);
      try {
        await db.createCollection('coll_6c', { indexing: { deny: ['*'] }, defaultId: { type: 'uuidv6' } });
        assert.fail('Expected an error');
      } catch (e) {
        assert.ok(e instanceof DataAPIResponseError);
      }
    });

    it('should create collections with different options in different keyspaces', async () => {
      const res = await db.createCollection('coll_7c', { indexing: { deny: ['*'] } });
      assert.ok(res);
      assert.strictEqual(res.name, 'coll_7c');
      assert.strictEqual(res.keyspace, DEFAULT_KEYSPACE);
      const res2 = await db.createCollection('coll_7c', { indexing: { deny: ['*'] }, keyspace: Cfg.OtherKeyspace });
      assert.ok(res2);
      assert.strictEqual(res2.name, 'coll_7c');
      assert.strictEqual(res2.keyspace, Cfg.OtherKeyspace);
    });

    it('(RERANKING) should create a collection with reranking/lexical enabled', async () => {
      const res = await db.createCollection('coll_8c', {
        vector: {
          metric: "cosine",
          service: {
            provider: 'upstageAI',
            modelName: 'solar-embedding-1-large',
          },
        },
        lexical: {
          enabled: true,
          analyzer: "STANDARD",
        },
        rerank: {
          enabled: true,
          service: {
            provider: "nvidia",
            modelName: "nvidia/llama-3.2-nv-rerankqa-1b-v2",
          },
        },
      });
      assert.ok(res);

      assert.strictEqual(res.name, 'coll_8c');
      assert.strictEqual(res.keyspace, DEFAULT_KEYSPACE);
    });

    it('(ASTRA) should work even when instantiated weirdly', async () => {
      const db = new DataAPIClient(Cfg.DbToken, { dbOptions: { keyspace: '123123123', dataApiPath: 'King' } })
        .admin({ adminToken: 'dummy-token' })
        .dbAdmin(Cfg.DbUrl, { dataApiPath: DEFAULT_DATA_API_PATHS.astra, keyspace: DEFAULT_KEYSPACE })
        .db()
        .admin({ adminToken: 'tummy-token', astraEnv: 'dev' })
        .db();

      const res = await db.createCollection('coll_9c', { indexing: { deny: ['*'] }, timeout: 60000 });
      assert.ok(res);
      assert.strictEqual(res.name, 'coll_9c');
      assert.strictEqual(res.keyspace, DEFAULT_KEYSPACE);
    });
  });

  describe('(LONG) dropCollection', () => {
    it('should drop a collection', async () => {
      await db.createCollection('coll_1d', { indexing: { deny: ['*'] } });
      await db.dropCollection('coll_1d');
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === 'coll_1d');
      assert.strictEqual(collection, undefined);
    });

    it('should drop a collection in non-default keyspace', async () => {
      await db.createCollection('coll_3d', { indexing: { deny: ['*'] }, keyspace: Cfg.OtherKeyspace });
      await db.dropCollection('coll_3d', { keyspace: Cfg.OtherKeyspace });
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === 'coll_3d');
      assert.strictEqual(collection, undefined);
    });

    it('should not drop a collection in different keyspace', async () => {
      await db.createCollection('coll_4d', { indexing: { deny: ['*'] } });
      await db.dropCollection('coll_4d', { keyspace: Cfg.OtherKeyspace });
      const collections = await db.listCollections();
      const collection = collections.find(c => c.name === 'coll_4d');
      assert.ok(collection);
    });
  });

  describe('listCollections', () => {
    it('should return a list of just names of collections with nameOnly set to true', async () => {
      const res = await db.listCollections({ nameOnly: true });
      const found = res.find((collection) => collection === Cfg.DefaultCollectionName);
      assert.ok(found);
    });

    it('should return a list of collections infos with nameOnly set to false', async () => {
      const res = await db.listCollections({ nameOnly: false });
      const found = res.find((collection) => collection.name === Cfg.DefaultCollectionName);
      assert.ok(found);
      assert.strictEqual(found.definition.vector?.dimension, 5);
      assert.strictEqual(found.definition.vector.metric, 'cosine');
    });

    it('should return a list of collections infos with nameOnly not set', async () => {
      const res = await db.listCollections();
      const found = res.find((collection) => collection.name === Cfg.DefaultCollectionName);
      assert.ok(found);
      assert.strictEqual(found.definition.vector?.dimension, 5);
      assert.strictEqual(found.definition.vector.metric, 'cosine');
    });
  });

  describe('(LONG) createType', () => {
    it('should create a UDT', async () => {
      await db.createType('type_1c', {
        definition: {
          fields: {
            street: 'text',
            city: 'text',
            zipCode: 'int',
          },
        },
        ifNotExists: true,
      });

      const types = await db.listTypes();
      const foundType = types.find(t => t.name === 'type_1c');
      assert.ok(foundType);
      assert.strictEqual(foundType.name, 'type_1c');
    });

    it('should create a UDT in another keyspace', async () => {
      await db.createType('type_2c', {
        definition: {
          fields: {
            name: 'text',
            age: 'int',
          },
        },
        keyspace: Cfg.OtherKeyspace,
        ifNotExists: true,
      });

      const types = await db.listTypes({ keyspace: Cfg.OtherKeyspace });
      const foundType = types.find(t => t.name === 'type_2c');
      assert.ok(foundType);
    });

    it('should create UDTs idempotently with ifNotExists', async () => {
      await db.createType('type_4c', {
        definition: {
          fields: { field1: 'text' },
        },
        ifNotExists: true,
      });

      await db.createType('type_4c', {
        definition: {
          fields: { field1: 'text' },
        },
        ifNotExists: true,
      });

      const types = await db.listTypes();
      const foundTypes = types.filter(t => t.name === 'type_4c');
      assert.strictEqual(foundTypes.length, 1);
    });

    it('should fail creating UDT with same name without ifNotExists', async () => {
      await db.createType('type_6c', {
        definition: {
          fields: { field1: 'text' },
        },
        ifNotExists: true,
      });

      try {
        await db.createType('type_6c', {
          definition: {
            fields: { field2: 'int' },
          },
        });
        assert.fail('Expected an error');
      } catch (e) {
        assert.ok(e instanceof DataAPIResponseError);
      }
    });

    it('should create UDTs with different options in different keyspaces', async () => {
      await db.createType('type_7c', {
        definition: {
          fields: { field1: 'text' },
        },
        ifNotExists: true,
      });

      await db.createType('type_7c', {
        definition: {
          fields: { field2: 'int' },
        },
        keyspace: Cfg.OtherKeyspace,
        ifNotExists: true,
      });

      await new Promise(resolve => setTimeout(resolve, 1000)); // may help fix an occasional issue where otherType is not found

      const defaultTypes = await db.listTypes();
      const otherTypes = await db.listTypes({ keyspace: Cfg.OtherKeyspace });

      const defaultType = defaultTypes.find(t => t.name === 'type_7c');
      const otherType = otherTypes.find(t => t.name === 'type_7c');

      assert.ok(defaultType);
      assert.ok(otherType);
    });
  });

  describe('(LONG) dropType', () => {
    it('should drop a UDT', async () => {
      await db.createType('type_1d', {
        definition: {
          fields: { field1: 'text' },
        },
      });

      await db.dropType('type_1d');

      const types = await db.listTypes();
      const foundType = types.find(t => t.name === 'type_1d');
      assert.strictEqual(foundType, undefined);
    });

    it('should drop a UDT in non-default keyspace', async () => {
      await db.createType('type_3d', {
        definition: {
          fields: { field1: 'text' },
        },
        keyspace: Cfg.OtherKeyspace,
      });

      await db.dropType('type_3d', { keyspace: Cfg.OtherKeyspace });

      const types = await db.listTypes({ keyspace: Cfg.OtherKeyspace });
      const foundType = types.find(t => t.name === 'type_3d');
      assert.strictEqual(foundType, undefined);
    });

    it('should not drop a UDT in different keyspace', async () => {
      await db.createType('type_4d', {
        definition: {
          fields: { field1: 'text' },
        },
        ifNotExists: true,
      });

      await db.dropType('type_4d', { keyspace: Cfg.OtherKeyspace, ifExists: true });

      const types = await db.listTypes();
      const foundType = types.find(t => t.name === 'type_4d');
      assert.ok(foundType);
    });
  });

  describe('listTypes', () => {
    it('should return a list of just names of UDTs with nameOnly set to true', async () => {
      await db.createType('list_test_type', {
        definition: {
          fields: { field1: 'text' },
        },
        ifNotExists: true,
      });

      const res = await db.listTypes({ nameOnly: true });
      assert.ok(Array.isArray(res));
      assert.ok(res.includes('list_test_type'));
      assert.strictEqual(typeof res[0], 'string');
    });

    it('should return a list of UDT infos with nameOnly set to false', async () => {
      await db.createType('list_test_type_2', {
        definition: {
          fields: {
            name: 'text',
            count: 'int',
          },
        },
        ifNotExists: true,
      });

      const res = await db.listTypes({ nameOnly: false });
      const foundType = res.find(t => t.name === 'list_test_type_2');
      assert.ok(foundType);
      assert.ok(foundType.definition);
      assert.strictEqual(foundType.definition.fields.name.type, 'text');
      assert.strictEqual(foundType.definition.fields.count.type, 'int');
    });

    it('should return a list of UDT infos with nameOnly not set', async () => {
      const res = await db.listTypes();
      assert.ok(Array.isArray(res));
      if (res.length > 0) {
        assert.ok(typeof res[0] === 'object');
        assert.ok('name' in res[0]);
      }
    });

    it('should not list UDTs in another keyspace', async () => {
      await db.createType('keyspace_specific_type', {
        definition: {
          fields: { field1: 'text' },
        },
        keyspace: Cfg.OtherKeyspace,
        ifNotExists: true,
      });

      const defaultTypes = await db.listTypes();
      const otherTypes = await db.listTypes({ keyspace: Cfg.OtherKeyspace });

      const defaultHasType = defaultTypes.some(t => t.name === 'keyspace_specific_type');
      const otherHasType = otherTypes.some(t => t.name === 'keyspace_specific_type');

      assert.strictEqual(defaultHasType, false);
      assert.strictEqual(otherHasType, true);
    });
  });

  describe('(LONG) alterType', () => {
    before(async () => {
      await Promise.all([
        db.dropType('alter_test_add', { ifExists: true }),
        db.dropType('alter_test_rename', { ifExists: true }),
        db.dropType('alter_test_keyspace', { ifExists: true, keyspace: Cfg.OtherKeyspace }),
      ]);
    });

    it('should add fields to UDT', async () => {
      await db.createType('alter_test_add', {
        definition: {
          fields: {
            name: 'text',
          },
        },
      });

      await db.alterType('alter_test_add', {
        operation: {
          add: {
            fields: {
              age: 'int',
              active: 'boolean',
            },
          },
        },
      });

      const types = await db.listTypes();
      const foundType = types.find(t => t.name === 'alter_test_add');
      assert.ok(foundType);
      assert.ok(foundType.definition);
      assert.strictEqual(foundType.definition.fields.name.type, 'text');
      assert.strictEqual(foundType.definition.fields.age.type, 'int');
      assert.strictEqual(foundType.definition.fields.active.type, 'boolean');
    });

    it('should rename fields in UDT', async () => {
      await db.createType('alter_test_rename', {
        definition: {
          fields: {
            old_name: 'text',
            zip_code: 'int',
          },
        },
      });

      await db.alterType('alter_test_rename', {
        operation: {
          rename: {
            fields: {
              old_name: 'new_name',
              zip_code: 'postal_code',
            },
          },
        },
      });

      const types = await db.listTypes();
      const foundType = types.find(t => t.name === 'alter_test_rename');
      assert.ok(foundType);
      assert.ok(foundType.definition);
      assert.ok('new_name' in foundType.definition.fields);
      assert.ok('postal_code' in foundType.definition.fields);
      assert.ok(!('old_name' in foundType.definition.fields));
      assert.ok(!('zip_code' in foundType.definition.fields));
    });

    it('should alter UDT in different keyspace', async () => {
      await db.createType('alter_test_keyspace', {
        definition: {
          fields: { field1: 'text' },
        },
        keyspace: Cfg.OtherKeyspace,
      });

      await db.alterType('alter_test_keyspace', {
        operation: {
          add: {
            fields: { field2: 'int' },
          },
        },
        keyspace: Cfg.OtherKeyspace,
      });

      const types = await db.listTypes({ keyspace: Cfg.OtherKeyspace });
      const foundType = types.find(t => t.name === 'alter_test_keyspace');
      assert.ok(foundType);
      assert.ok(foundType.definition);
      assert.ok('field2' in foundType.definition.fields);
    });
  });

  describe('command', () => {
    it('should execute a db-level command', async () => {
      const resp = await db.command({ findCollections: {} });
      assert.strictEqual(resp.status?.data, undefined);
      assert.strictEqual(resp.status?.errors, undefined);
      assert.ok(resp.status?.collections instanceof Array);
    });

    it('should execute a db-level command in different keyspace', async () => {
      const resp = await db.command({ findCollections: {} }, { keyspace: Cfg.OtherKeyspace });
      assert.strictEqual(resp.status?.data, undefined);
      assert.strictEqual(resp.status?.errors, undefined);
      assert.ok(resp.status?.collections instanceof Array);
    });

    // TODO
    // it('should execute a collection-level command', async () => {
    //   const uuid = UUID.v4();
    //   const collection = db.collection(Cfg.DefaultCollectionName);
    //   await collection.insertOne({ _id: uuid });
    //   const resp = await db.command({ findOne: { filter: { _id: uuid } } }, { collection: Cfg.DefaultCollectionName });
    //   assert.deepStrictEqual(resp, { status: undefined, data: { document: { _id: uuid } }, errors: undefined });
    // });
    //
    // it('should execute a collection-level command in different keyspace', async () => {
    //   const uuid = UUID.v4();
    //   const collection = db.collection(Cfg.DefaultCollectionName, { keyspace: Cfg.OtherKeyspace });
    //   await collection.insertOne({ _id: uuid });
    //   const resp = await db.command({ findOne: { filter: { _id: uuid } } }, { collection: Cfg.DefaultCollectionName, keyspace: Cfg.OtherKeyspace });
    //   assert.deepStrictEqual(resp, { status: undefined, data: { document: { _id: uuid } }, errors: undefined });
    // });

    it('should throw an error when performing collections-level command on non-existent collections', async () => {
      try {
        await db.command({ findOne: {} }, { collection: 'dasfsdaf' });
        assert.fail('Expected an error');
      } catch (e) {
        assert.ok(e instanceof DataAPIResponseError);
      }
    });

    it('should throw an error if no keyspace set', async () => {
      const { db } = initTestObjects();
      db.useKeyspace(undefined!);
      await assert.rejects(() => db.command({ findEmbeddingProviders: {} }), { message: 'Db is missing a required keyspace; be sure to set one with client.db(..., { keyspace }), or db.useKeyspace()' });
    });

    it('should not throw an error if no keyspace set but keyspace: null', async () => {
      const { db } = initTestObjects();
      db.useKeyspace(undefined!);
      await assert.doesNotReject(() => db.command({ findEmbeddingProviders: {} }, { keyspace: null }));
    });
  });
});
