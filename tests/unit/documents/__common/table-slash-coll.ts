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

import { describe, initTestObjects, it } from '@/tests/testlib/index.js';
import assert from 'assert';
import type {
  Collection,
  CollectionFindAndRerankCursor,
  CollectionFindCursor,
  SomeRow,
  Table,
  TableFindAndRerankCursor,
  TableFindCursor,
} from '@/src/documents/index.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import { RootOptsHandler } from '@/src/client/opts-handlers/root-opts-handler.js';
import { TokenProvider } from '@/src/lib/index.js';
import fc from 'fast-check';
import { DataAPIHttpClient } from '@/src/lib/api/clients/index.js';

interface TableSlashCollUnitTestConfig {
  className: 'Table' | 'Collection',
  mkTSlashC: (...params: ConstructorParameters<typeof Table | typeof Collection>) => Table<SomeRow> | Collection,
  findCursorClass: typeof TableFindCursor | typeof CollectionFindCursor,
  rerankCursorClass: typeof TableFindAndRerankCursor | typeof CollectionFindAndRerankCursor,
}

export const unitTestTableSlashColls = ({ mkTSlashC, ...cfg }: TableSlashCollUnitTestConfig) => {
  const { client, db } = initTestObjects();

  const opts = RootOptsHandler(TokenProvider.opts.empty, client).parse({});

  describe('accessors', () => {
    describe('name', () => {
      fc.assert(
        fc.property(fc.string(), (name) => {
          const tsc = mkTSlashC(db, db._httpClient, name, opts, undefined);
          assert.strictEqual(tsc.name, name);
        }),
      );
    });

    describe('keyspace', () => {
      it('returns the given keyspace', () => {
        fc.assert(
          fc.property(fc.string(), (keyspace) => {
            const tsc = mkTSlashC(db, db._httpClient, 'tsc', opts, { keyspace });
            assert.strictEqual(tsc.keyspace, keyspace);
          }),
        );
      });

      it('inherits the keyspace from the db if not set', () => {
        const { db } = initTestObjects();

        fc.assert(
          fc.property(fc.string().filter(Boolean), (ks) => {
              db.useKeyspace(ks);
              const tsc = mkTSlashC(db, db._httpClient, 'tsc', opts, undefined);
              assert.strictEqual(tsc.keyspace, ks);
            },
          ),
        );
      });
    });
  });

  describe('methods', () => {
    const tsc = mkTSlashC(db, db._httpClient, 'test', opts, undefined);

    describe('_httpClient', () => {
      it('returns the underlying DataAPIHTTPClient', () => {
        assert.ok(tsc._httpClient instanceof DataAPIHttpClient);
      });
    });

    describe('$CustomInspect', () => {
      it('works', () => {
        fc.assert(
          fc.property(fc.string(), fc.string(), (keyspace, name) => {
            const tsc = mkTSlashC(db, db._httpClient, name, opts, { keyspace });
            assert.strictEqual((tsc as any)[$CustomInspect](), `${cfg.className}(keyspace="${keyspace}",name="${name}")`);
          }),
        );
      });
    });

    describe('find', () => {
      it(`returns a ${cfg.className}FindCursor`, () => {
        assert.ok(tsc.find({}) instanceof cfg.findCursorClass);
      });
    });
  });
};
