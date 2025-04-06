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

import { DEFAULT_KEYSPACE } from '@/src/lib/api/index.js';
import { describe, it } from '@/tests/testlib/index.js';
import assert from 'assert';
import { Table } from '@/src/documents/index.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import { RootOptsHandler } from '@/src/client/opts-handlers/root-opts-handler.js';
import { TokenProvider } from '@/src/lib/index.js';

describe('unit.documents.tables.table', ({ db, client }) => {
  const opts = RootOptsHandler(TokenProvider.opts.empty, client).parse({});

  describe('initialization', () => {
    it('should initialize a Table', () => {
      const table = new Table(db, db._httpClient, 'new_table', opts, undefined);
      assert.ok(table);
    });
  });

  describe('accessors', () => {
    it('returns the given keyspace', () => {
      const table = new Table(db, db._httpClient, 'new_table', opts, { keyspace: 'hello' });
      assert.strictEqual(table.keyspace, "hello");
    });

    it('returns the default keyspace if not set', () => {
      const table = new Table(db, db._httpClient, 'new_table', opts, undefined);
      assert.strictEqual(table.keyspace, DEFAULT_KEYSPACE);
    });

    it('returns the name', () => {
      const table = new Table(db, db._httpClient, 'new_table', opts, undefined);
      assert.strictEqual(table.name, 'new_table');
    });
  });

  it('should inspect properly', () => {
    const table = new Table(db, db._httpClient, 'new_table', opts, undefined);
    assert.strictEqual((table as any)[$CustomInspect](), 'Table(keyspace="default_keyspace",name="new_table")');
  });
});
