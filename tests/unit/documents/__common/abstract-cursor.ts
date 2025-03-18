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
import { describe, it } from '@/tests/testlib/index.js';
import {
  Collection,
  CollectionFindAndRerankCursor,
  CollectionFindCursor,
  SomeRow,
  Table,
  TableFindAndRerankCursor,
  TableFindCursor,
} from '@/src/documents/index.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import fc from 'fast-check';

export interface AbstractCursorTestConfig {
  parent: Table<SomeRow> | Collection,
  CursorImpl: typeof CollectionFindCursor | typeof TableFindCursor | typeof TableFindAndRerankCursor | typeof CollectionFindAndRerankCursor,
}

export const unitTestAbstractCursor = ({ CursorImpl, parent }: AbstractCursorTestConfig) => {
  describe('accessors', () => {
    describe('state', () => {
      it('should be idle on initialization', () => {
        const cursor = new CursorImpl(parent, null!, [{}, false]);
        assert.strictEqual(cursor.state, 'idle');
      });
    });

    describe('dataSource', () => {
      it('should return the parent', () => {
        const cursor = new CursorImpl(parent, null!, [{}, false]);
        assert.strictEqual(cursor.dataSource, parent);
      });
    });
  });

  describe('methods', () => {
    describe('buffered', () => {
      it('should return 0 on a pristine cursor', () => {
        const cursor = new CursorImpl(parent, null!, [{}, false]);
        assert.strictEqual(cursor.buffered(), 0);
      });

      it('should return the length of cursor._buffer', () => {
        fc.assert(
          fc.property(fc.integer(), (count) => {
            const cursor = new CursorImpl(parent, null!, [{}, false]);
            cursor['_buffer'] = Array(count);
            assert.strictEqual(cursor.buffered(), count);
          }),
        );
      });
    });

    describe('consumed', () => {
      it('should return 0 on a pristine cursor', () => {
        const cursor = new CursorImpl(parent, null!, [{}, false]);
        assert.strictEqual(cursor.consumed(), 0);
      });

      it('should return cursor._consumed', () => {
        fc.assert(
          fc.property(fc.integer(), (count) => {
            const cursor = new CursorImpl(parent, null!, [{}, false]);
            cursor['_consumed'] = count;
            assert.strictEqual(cursor.consumed(), count);
          }),
        );
      });
    });

    describe('consumeBuffer', () => {
      it('should return ', () => {
        
      });
    });
  });
};
