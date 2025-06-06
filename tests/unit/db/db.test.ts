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
import { Db } from '@/src/db/db.js';
import { DataAPIEnvironments, StaticTokenProvider, TokenProvider } from '@/src/lib/index.js';
import type { AdminOptions, DbOptions } from '@/src/client/index.js';
import { DataAPIClient } from '@/src/client/index.js';
import { Cfg, DemoAstraEndpoint, describe, it } from '@/tests/testlib/index.js';
import { DEFAULT_DATA_API_PATHS, DEFAULT_KEYSPACE } from '@/src/lib/api/constants.js';
import { buildAstraEndpoint } from '@/src/lib/utils.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import { DbOptsHandler } from '@/src/client/opts-handlers/db-opts-handler.js';
import type { ParsedEnvironment } from '@/src/client/opts-handlers/environment-cfg-handler.js';
import { RootOptsHandler } from '@/src/client/opts-handlers/root-opts-handler.js';

describe('unit.db.db', () => {
  const internalOps = (db?: Partial<DbOptions>, devops?: Partial<AdminOptions>) => RootOptsHandler(TokenProvider.opts.empty, null!).parse({
    dbOptions: { token: new StaticTokenProvider('old'), ...db },
    adminOptions: { adminToken: new StaticTokenProvider('old-admin'), ...devops },
  });

  describe('constructor tests', () => {
    it('should allow db construction from endpoint', () => {
      const db = new Db(internalOps(), 'https://id-region.apps.astra.datastax.com', DbOptsHandler.empty);
      assert.ok(db);
      assert.strictEqual(db._httpClient.baseUrl, `https://id-region.apps.astra.datastax.com/${DEFAULT_DATA_API_PATHS.astra}`);
    });

    it('should trim trailing slash in endpoints', () => {
      for (let i = 0; i < 10; i++) {
        const db = new Db(internalOps(), `https://id-region.apps.astra.datastax.com${'/'.repeat(i)}`, DbOptsHandler.empty);
        assert.strictEqual(db._httpClient.baseUrl, `https://id-region.apps.astra.datastax.com/${DEFAULT_DATA_API_PATHS.astra}`);
      }
    });

    it('should not throw on missing token', () => {
      const client = new DataAPIClient();
      assert.doesNotThrow(() => client.db(Cfg.DbUrl));
    });
  });

  describe('new Db tests', () => {
    it('should allow db construction from endpoint, using default options', () => {
      const db = new Db(internalOps(), 'https://id-region.apps.astra.datastax.com', DbOptsHandler.empty);
      assert.ok(db);
      assert.strictEqual(db._httpClient.baseUrl, `https://id-region.apps.astra.datastax.com/${DEFAULT_DATA_API_PATHS.astra}`);
    });

    it('should allow db construction from endpoint, overwriting options', () => {
      const db = new Db(internalOps({ dataApiPath: 'old', keyspace: 'old' }), 'https://id-region.apps.astra.datastax.com', DbOptsHandler.parse({ dataApiPath: 'new', keyspace: 'new' }));
      assert.ok(db);
      assert.strictEqual(db._httpClient.baseUrl, 'https://id-region.apps.astra.datastax.com/new');
      assert.strictEqual(db.keyspace, 'new');
    });

    it('is initialized with default keyspace', () => {
      const db = new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.empty);
      assert.strictEqual(db.keyspace, DEFAULT_KEYSPACE);
    });

    it('uses custom keyspace when provided', () => {
      const db = new Db(internalOps({ keyspace: 'new_keyspace' }), Cfg.DbUrl, DbOptsHandler.empty);
      assert.strictEqual(db.keyspace, 'new_keyspace');
    });

    it('overrides keyspace in db when provided', () => {
      const db = new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({ keyspace: 'new_keyspace' }));
      assert.strictEqual(db.keyspace, 'new_keyspace');
    });

    it('throws error on empty keyspace', () => {
      assert.throws(() => {
        new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({ keyspace: '' }));
      });
    });

    it('throws error on invalid keyspace', () => {
      assert.throws(() => {
        new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({ keyspace: 'bad keyspace' }));
      });
    });

    it('handles different dataApiPath', () => {
      const db = new Db(internalOps({ dataApiPath: 'api/json/v2' }), Cfg.DbUrl, DbOptsHandler.empty);
      assert.strictEqual(db._httpClient.baseUrl, `${Cfg.DbUrl}/api/json/v2`);
    });

    it('handles different dataApiPath when overridden', () => {
      const db = new Db(internalOps({ dataApiPath: 'api/json/v2' }), Cfg.DbUrl, DbOptsHandler.parse({ dataApiPath: 'api/json/v3' }));
      assert.strictEqual(db._httpClient.baseUrl, `${Cfg.DbUrl}/api/json/v3`);
    });

    it('should accept valid logging', () => {
      assert.ok(new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({})));
      assert.ok(new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({ logging: 'all' })));
      assert.ok(new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({ logging: ['adminCommandPolling', 'adminCommandStarted'] })));
      assert.ok(new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({ logging: ['all', { events: 'all', emits: 'event' }] })));
      assert.ok(new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({ logging: [{ events: ['adminCommandPolling', 'adminCommandSucceeded'], emits: ['event', 'stdout'] }]})));
    });

    it('should accept valid dataApiPath', () => {
      assert.ok(() => new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({})));
      assert.ok(() => new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({ dataApiPath: 'api/json/v2' })));
      assert.ok(() => new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({ dataApiPath: null! })));
      assert.ok(() => new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({ dataApiPath: undefined })));
    });

    it('should throw on invalid dataApiPath', () => {
      // @ts-expect-error - testing invalid input
      assert.throws(() => new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({ dataApiPath: 1 })));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({ dataApiPath: [] })));
      // @ts-expect-error - testing invalid input
      assert.throws(() => new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.parse({ dataApiPath: {} })));
    });
  });

  describe('id tests', () => {
    it('should return the id from the endpoint', () => {
      const db = new Db(internalOps(), buildAstraEndpoint('f1183f14-dc85-4fbf-8aae-f1ca97338bbb', 'us-east1'), DbOptsHandler.empty);
      assert.strictEqual(db.id, 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb');
    });

    it('should throw error if attempting to get ID for non-astra db', () => {
      const db = new Db({ ...internalOps(), environment: 'dse' as ParsedEnvironment }, 'https://localhost:3000', DbOptsHandler.empty);
      assert.throws(() => db.id);
    });

    it('should throw error if attempting to get ID for custom-domain astra db', () => {
      const db = new Db(internalOps(), 'https://localhost:3000', DbOptsHandler.empty);
      assert.throws(() => db.id);
    });
  });

  describe('region tests', () => {
    it('should return the region from the endpoint', () => {
      const db = new Db(internalOps(), buildAstraEndpoint('f1183f14-dc85-4fbf-8aae-f1ca97338bbb', 'us-east1'), DbOptsHandler.empty);
      assert.strictEqual(db.region, 'us-east1');
    });

    it('should throw error if attempting to get region for non-astra db', () => {
      const db = new Db({ ...internalOps(), environment: 'dse' as ParsedEnvironment }, 'https://localhost:3000', DbOptsHandler.empty);
      assert.throws(() => db.region);
    });

    it('should throw error if attempting to get region for custom-domain astra db', () => {
      const db = new Db(internalOps(), 'https://localhost:3000', DbOptsHandler.empty);
      assert.throws(() => db.region);
    });
  });

  describe('keyspace tests', () => {
    it('should return the keyspace passed into the constructor', () => {
      const db = new Db(internalOps({ keyspace: 'keyspace' }), Cfg.DbUrl, DbOptsHandler.empty);
      assert.strictEqual(db.keyspace, 'keyspace');
    });

    it('should throw an error if the keyspace is not set in the keyspace', () => {
      const db = new Db({ ...internalOps(), environment: 'dse' as ParsedEnvironment }, Cfg.DbUrl, DbOptsHandler.empty);
      assert.throws(() => db.keyspace);
    });

    it('should mutate the keyspace (non-retroactively)', () => {
      const db = new Db(internalOps({ keyspace: 'keyspace' }), Cfg.DbUrl, DbOptsHandler.empty);
      const coll1 = db.collection('coll');
      assert.strictEqual(db.keyspace, 'keyspace');
      assert.strictEqual(coll1.keyspace, 'keyspace');

      db.useKeyspace('other_keyspace');
      const coll2 = db.collection('coll');
      assert.strictEqual(db.keyspace, 'other_keyspace');
      assert.strictEqual(coll1.keyspace, 'keyspace');
      assert.strictEqual(coll2.keyspace, 'other_keyspace');
    });

    it('should should not throw an error when getting keyspace if keyspace is set later', () => {
      const db = new Db({ ...internalOps(), environment: 'dse' as ParsedEnvironment }, Cfg.DbUrl, DbOptsHandler.empty);
      assert.throws(() => db.keyspace);
      db.useKeyspace('other_keyspace');
      assert.strictEqual(db.keyspace, 'other_keyspace');
    });
  });

  describe('admin tests', () => {
    it('should accept matching environments', () => {
      assert.doesNotThrow(() => {
        const db = new DataAPIClient('dummy_token').db(DemoAstraEndpoint);
        db.admin();
      });
      assert.doesNotThrow(() => {
        const db = new DataAPIClient('dummy_token', { environment: 'dse' }).db('https://localhost:3000');
        db.admin({ environment: 'dse' });
      });
      assert.doesNotThrow(() => {
        const db = new DataAPIClient('dummy_token', { environment: 'other' }).db('https://localhost:3000');
        db.admin({ environment: 'other' });
      });
    });

    it('should throw on mismatching environments', () => {
      assert.throws(() => {
        const db = new DataAPIClient('dummy_token').db(DemoAstraEndpoint);
        db.admin({ environment: 'dse' });
      }, { message: 'Invalid environment \'dse\' for operation \'db.admin()\' (environment option is not the same as set in the DataAPIClient); expected environment(s): \'astra\'' });
      assert.throws(() => {
        const db = new DataAPIClient('dummy_token', { environment: 'dse' }).db(DemoAstraEndpoint);
        db.admin();
      }, { message: 'Invalid environment \'astra\' for operation \'db.admin()\' (environment option is not the same as set in the DataAPIClient); expected environment(s): \'dse\'' });
      assert.throws(() => {
        const db = new DataAPIClient('dummy_token', { environment: 'dse' }).db(DemoAstraEndpoint);
        db.admin({ environment: 'hcd' });
      }, { message: 'Invalid environment \'hcd\' for operation \'db.admin()\' (environment option is not the same as set in the DataAPIClient); expected environment(s): \'dse\'' });
    });

    it('should return the admin if on astra db', () => {
      const db = new Db(internalOps(), buildAstraEndpoint('f1183f14-dc85-4fbf-8aae-f1ca97338bbb', 'us-east1'), DbOptsHandler.empty);
      assert.strictEqual(db.admin().id, 'f1183f14-dc85-4fbf-8aae-f1ca97338bbb');
    });
  });

  describe('info tests', () => {
    it('should error on invalid environment', async () => {
      for (const env of DataAPIEnvironments.filter(e => e !== 'astra')) {
        const db = new Db({ ...internalOps(), environment: env as ParsedEnvironment }, Cfg.DbUrl, DbOptsHandler.empty);
        await assert.rejects(() => db.info(), { message: `Invalid environment '${env}' for operation 'db.info()' (info() is only available for Astra databases); expected environment(s): 'astra'` });
      }
    });
  });

  describe('command tests', ({ db }) => {
    it('should throw if both table & collection passed', async () => {
      await assert.rejects(() => db.command({}, { collection: 'coll', table: 'table' }), { message: 'Can\'t provide both `table` and `collection` as options to DataAPIHttpClient.executeCommand()' });
    });

    it('should throw if null space & table/collection passed', async () => {
      await assert.rejects(() => db.command({}, { keyspace: null, table: 'table' }), { message: 'Keyspace may not be `null` when a table or collection is provided to DataAPIHttpClient.executeCommand()' });
      await assert.rejects(() => db.command({}, { keyspace: null, collection: 'coll' }), { message: 'Keyspace may not be `null` when a table or collection is provided to DataAPIHttpClient.executeCommand()' });
    });
  });

  describe('inspect tests', () => {
    it('should work', () => {
      const db = new Db(internalOps(), Cfg.DbUrl, DbOptsHandler.empty);
      assert.strictEqual((db as any)[$CustomInspect](), `Db(endpoint="${Cfg.DbUrl}",keyspace="${DEFAULT_KEYSPACE}")`);
    });
  });
});
