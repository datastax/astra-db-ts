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
import { describe, it } from '@/tests/testlib';
import { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { FindCursor } from '@/src/documents';

describe('unit.documents.cursor', () => {
  let httpClient: DataAPIHttpClient;

  it('should initialize an uninitialized Cursor', () => {
    const cursor = new FindCursor<any>('', httpClient, null!, {});
    assert.ok(cursor);
    assert.strictEqual(cursor.buffered(), 0);
    assert.strictEqual(cursor.consumed(), 0);
    assert.strictEqual(cursor.state, 'idle');
  });

  it('should contain the proper keyspace', () => {
    const cursor = new FindCursor<any>('abc', httpClient, null!, {});
    assert.strictEqual(cursor.keyspace, 'abc');
  });

  it('should fail to set projection after mapping', () => {
    const cursor1 = new FindCursor<any>('', httpClient, null!, {});
    const cursor2 = cursor1.map((x) => x);
    assert.doesNotThrow(() => cursor1.project({}));
    assert.throws(() => cursor2.project({}));
  });
});
