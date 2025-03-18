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
import type {
  Collection,
  CollectionFindAndRerankCursor,
  CollectionFindCursor,
  SomeDoc,
  SomeRow,
  Table,
  TableFindAndRerankCursor,
  TableFindCursor,
} from '@/src/documents/index.js';
import fc from 'fast-check';
import { QueryState } from '@/src/lib/utils.js';
import { DeltaAsserter } from '@/tests/testlib/utils.js';
import type { LitUnion } from '@/src/lib/index.js';
import { arbs } from '@/tests/testlib/arbitraries.js';

export const AbstractCursorDeltaAsserter = new DeltaAsserter(['_buffer', '_consumed', '_nextPageState', '_state', '_mapping', '_options']);

type DeltaAsserterFields = LitUnion<typeof AbstractCursorDeltaAsserter extends DeltaAsserter<infer Fs> ? Fs : never>;

export interface AbstractCursorTestConfig {
  parent: Table<SomeRow> | Collection,
  CursorImpl: typeof CollectionFindCursor | typeof TableFindCursor | typeof TableFindAndRerankCursor | typeof CollectionFindAndRerankCursor,
  DeltaAsserter: DeltaAsserter<DeltaAsserterFields>
}

export const unitTestAbstractCursor = ({ CursorImpl, parent, DeltaAsserter }: AbstractCursorTestConfig) => {
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
          fc.property(fc.nat(), (count) => {
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
      it('should consume all docs & increase consumed() if no max parameter passed', () => {
        fc.assert(
          fc.property(fc.array(fc.anything()), (buffer) => {
            const cursor = new CursorImpl(parent, null!, [{}, false]);
            cursor['_buffer'] = [...buffer] as SomeDoc[];

            assert.strictEqual(cursor.consumed(), 0);
            assert.strictEqual(cursor.buffered(), buffer.length);

            DeltaAsserter
              .captureMutDelta(cursor, () => {
                const consumed = cursor.consumeBuffer();
                assert.deepStrictEqual(consumed, buffer);
              })
              .assertDelta({
                _consumed: buffer.length,
                _buffer: [],
              });

            assert.strictEqual(cursor.consumed(), buffer.length);
            assert.strictEqual(cursor.buffered(), 0);
          }),
        );
      });

      it('should consume the max docs possible & increase consumed() if max parameter passed', () => {
        fc.assert(
          fc.property(fc.array(fc.anything()), fc.nat(), (buffer, max) => {
            const cursor = new CursorImpl(parent, null!, [{}, false]);
            cursor['_buffer'] = [...buffer] as SomeDoc[];

            assert.strictEqual(cursor.consumed(), 0);
            assert.strictEqual(cursor.buffered(), buffer.length);

            const expectedConsumed = Math.min(buffer.length, max);

            DeltaAsserter
              .captureMutDelta(cursor, () => {
                const consumed = cursor.consumeBuffer(max);
                assert.deepStrictEqual(consumed, buffer.slice(0, expectedConsumed));
              })
              .assertDelta({
                _consumed: expectedConsumed,
                _buffer: buffer.slice(expectedConsumed),
              });

            assert.strictEqual(cursor.consumed(), expectedConsumed);
            assert.strictEqual(cursor.buffered(), buffer.length - expectedConsumed);
          }),
        );
      });
    });

    describe('rewind', () => {
      it('should reset the state, buffer, consumed, and nextPageState', () => {
        fc.assert(
          fc.property(fc.array(fc.anything()), fc.integer(), fc.option(fc.string()), fc.constantFrom('idle', 'started', 'closed'), (buffer, consumed, qs, state) => {
            const cursor = new CursorImpl(parent, null!, [{}, false]);
            cursor['_buffer'] = [...buffer] as SomeDoc[];
            cursor['_consumed'] = consumed;
            cursor['_nextPageState'] = new QueryState<string>().swap(qs);
            cursor['_state'] = state;

            assert.strictEqual(cursor.state, state);
            assert.strictEqual(cursor.buffered(), buffer.length);
            assert.strictEqual(cursor.consumed(), consumed);

            DeltaAsserter
              .captureMutDelta(cursor, () => {
                cursor.rewind();
              })
              .assertDelta({
                _state: 'idle',
                _buffer: [],
                _consumed: 0,
                _nextPageState: new QueryState(),
              });

            assert.strictEqual(cursor.state, 'idle');
            assert.strictEqual(cursor.buffered(), 0);
            assert.strictEqual(cursor.consumed(), 0);
          }),
        );
      });
    });

    describe('close', () => {
      it('should set the state to closed', () => {
        fc.assert(
          fc.property(arbs.cursorState(), (state) => {
            const cursor = new CursorImpl(parent, null!, [{}, false]);
            cursor['_state'] = state;

            DeltaAsserter
              .captureMutDelta(cursor, () => {
                cursor.close();
              })
              .assertDelta({
                _state: 'closed',
              });

            assert.strictEqual(cursor.state, 'closed');
          }),
        );
      });

      it('should reset the buffer but not consumed', () => {
        fc.assert(
          fc.property(fc.array(fc.anything()), fc.integer(), (buffer, consumed) => {
            const cursor = new CursorImpl(parent, null!, [{}, false]);
            cursor['_buffer'] = [...buffer] as SomeDoc[];
            cursor['_consumed'] = consumed;

            assert.strictEqual(cursor.buffered(), buffer.length);
            assert.strictEqual(cursor.consumed(), consumed);

            DeltaAsserter
              .captureMutDelta(cursor, () => {
                cursor.close();
              })
              .assertDelta({
                _buffer: [],
                _state: 'closed',
              });

            assert.strictEqual(cursor.buffered(), 0);
            assert.strictEqual(cursor.consumed(), consumed);
          }),
        );
      });
    });
  });
};
