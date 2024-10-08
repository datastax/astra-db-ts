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
import { DEFAULT_COLLECTION_NAME, describe, it } from '@/tests/testlib';
import assert from 'assert';

describe('unit.documents.collections', ({ db, collection }) => {
  describe('initialization', () => {
    it('should initialize a Collection', () => {
      const collection = new Collection(db, db['_httpClient'], 'new_collection', undefined);
      assert.ok(collection);
    });
  });

  describe('accessors', () => {
    it('returns the keyspace', () => {
      assert.strictEqual(collection.keyspace, DEFAULT_KEYSPACE);
    });

    it('returns the name', () => {
      assert.strictEqual(collection.collectionName, DEFAULT_COLLECTION_NAME);
    });
  });
});
