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

import { Collection } from '@/src/documents/collections';
import { DEFAULT_KEYSPACE } from '@/src/lib/api';
import { describe, it } from '@/tests/testlib';
import assert from 'assert';

describe('unit.documents.collections', ({ db }) => {
  describe('initialization', () => {
    it('should initialize a Collection', () => {
      const collection = new Collection(db, db._httpClient, 'new_collection', undefined);
      assert.ok(collection);
    });
  });

  describe('accessors', () => {
    it('returns the given keyspace', () => {
      const collection = new Collection(db, db._httpClient, 'new_collection', { keyspace: 'hello' });
      assert.strictEqual(collection.keyspace, "hello");
    });

    it('returns the default keyspace if not set', () => {
      const collection = new Collection(db, db._httpClient, 'new_collection', undefined);
      assert.strictEqual(collection.keyspace, DEFAULT_KEYSPACE);
    });

    it('returns the name', () => {
      const collection = new Collection(db, db._httpClient, 'new_collection', undefined);
      assert.strictEqual(collection.name, 'new_collection');
    });
  });
});
