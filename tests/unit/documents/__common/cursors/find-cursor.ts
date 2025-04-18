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

import type { CollectionFindCursor, FindCursor, Sort, TableFindCursor } from '@/src/documents/index.js';
import { CursorError } from '@/src/documents/index.js';
import type { AbstractCursorTestConfig } from '@/tests/unit/documents/__common/cursors/abstract-cursor.js';
import {
  AbstractCursorDeltaAsserter,
  unitTestAbstractCursor,
} from '@/tests/unit/documents/__common/cursors/abstract-cursor.js';
import { DeltaAsserter } from '@/tests/testlib/utils.js';
import fc from 'fast-check';
import { arbs } from '@/tests/testlib/arbitraries.js';
import assert from 'assert';
import { describe, it } from '@/tests/testlib/index.js';
import { UUID } from '@/src/documents/datatypes/uuid.js';
import type { SerDes } from '@/src/lib/api/ser-des/ser-des.js';
import { QueryState } from '@/src/lib/utils.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import { SerDesTarget } from '@/src/lib/index.js';

interface FindCursorTestConfig extends Omit<AbstractCursorTestConfig, 'DeltaAsserter'> {
  CursorImpl: typeof CollectionFindCursor | typeof TableFindCursor,
  serdes: SerDes,
}

const CursorDeltaAsserter = new DeltaAsserter(['_serdes', '_parent', '_filter', '_sortVector'], AbstractCursorDeltaAsserter);

export const unitTestFindCursor = ({ CursorImpl, parent, ...cfg }: FindCursorTestConfig) => {
  unitTestAbstractCursor({ CursorImpl, parent, DeltaAsserter: CursorDeltaAsserter });

  describe('misc', () => {
    it('should throw an error when calling a builder method on a non-idle cursor', () => {
      const properties = <const>['filter', 'sort', 'limit', 'skip', 'project', 'includeSimilarity', 'includeSortVector', 'map'] satisfies (keyof FindCursor<unknown>)[];

      fc.assert(
        fc.property(fc.constantFrom(...properties), (builder) => {
          const cursor = new CursorImpl(parent, cfg.serdes, [{}, false]);
          cursor['_state'] = (Math.random() > .5) ? 'started' : 'closed';
          assert.throws(() => (cursor as any)[builder](), (e) => e instanceof CursorError && e.message.includes('on a running/closed cursor'));
        }),
      );
    });
  });

  describe('methods', () => {
    describe('filter', () => {
      it('should create a new cursor with a new pre-serialized filter', () => {
        const cursor = new CursorImpl(parent, cfg.serdes, [{}, false]);
        const uuid = UUID.v4();

        const newFilter = cfg.serdes.serialize({ uuid }, SerDesTarget.Filter);

        CursorDeltaAsserter
          .captureImmutDelta(cursor, () => cursor.filter({ uuid }))
          .assertDelta({ _filter: newFilter });
      });
    });

    describe('sort', () => {
      it('should create a new cursor with a new pre-serialized sort', () => {
        fc.assert(
          fc.property(arbs.record(fc.anything()), arbs.record(fc.anything()), (sort, oldOptions) => {
            const cursor = new CursorImpl(parent, cfg.serdes, [{}, false], oldOptions);

            const newSort = cfg.serdes.serialize(sort, SerDesTarget.Sort)[0];

            CursorDeltaAsserter
              .captureImmutDelta(cursor, () => cursor.sort(sort as Sort))
              .assertDelta({ _options: { ...oldOptions, sort: newSort } });
          }),
        );
      });
    });

    describe('limit', () => {
      it('should create a new cursor with a new limit', () => {
        fc.assert(
          fc.property(fc.nat(), arbs.record(fc.anything()), (limit, oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);

            CursorDeltaAsserter
              .captureImmutDelta(cursor, () => cursor.limit(limit))
              .assertDelta({ _options: { ...oldOptions, limit: limit || undefined } });
          }),
        );
      });
    });

    describe('skip', () => {
      it('should create a new cursor with a new skip', () => {
        fc.assert(
          fc.property(fc.nat(), arbs.record(fc.anything()), (skip, oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);

            CursorDeltaAsserter
              .captureImmutDelta(cursor, () => cursor.skip(skip))
              .assertDelta({ _options: { ...oldOptions, skip } });
          }),
        );
      });
    });

    describe('project', () => {
      it('should error if set after mapping', () => {
        assert.throws(() => {
          new CursorImpl(parent, null!, [{}, false]).map((x) => x).project({});
        }, (e) => {
          return e instanceof CursorError && e.message.includes('after already using cursor.map');
        });
      });

      it('should create a new cursor with a new projection', () => {
        fc.assert(
          fc.property(arbs.record(fc.oneof(fc.constantFrom(0, 1), fc.boolean())), arbs.record(fc.anything()), (projection, oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);

            CursorDeltaAsserter
              .captureImmutDelta(cursor, () => cursor.project(projection))
              .assertDelta({ _options: { ...oldOptions, projection } });
          }),
        );
      });
    });

    describe('includeSimilarity', () => {
      it('should error if set after mapping', () => {
        assert.throws(() => {
          new CursorImpl(parent, null!, [{}, false]).map((x) => x).includeSimilarity();
        }, (e) => {
          return e instanceof CursorError && e.message.includes('after already using cursor.map');
        });
      });

      it('should create a new cursor with similarity included', () => {
        fc.assert(
          fc.property(fc.constantFrom(undefined, true, false), arbs.record(fc.anything()), (include, oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);

            CursorDeltaAsserter
              .captureImmutDelta(cursor, () => cursor.includeSimilarity(include))
              .assertDelta({ _options: { ...oldOptions, includeSimilarity: include ?? true } });
          }),
        );
      });
    });

    describe('includeSortVector', () => {
      it('should create a new cursor with sort vector included', () => {
        fc.assert(
          fc.property(fc.constantFrom(undefined, true, false), arbs.record(fc.anything()), (include, oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);

            CursorDeltaAsserter
              .captureImmutDelta(cursor, () => cursor.includeSortVector(include))
              .assertDelta({ _options: { ...oldOptions, includeSortVector: include ?? true } });
          }),
        );
      });
    });

    describe('map', () => {
      it('should create a new cursor by composing mappings', () => {
        const cursor = new CursorImpl(parent, null!, [{}, false]);

        const mapping1 = () => 3;
        const cursor1 = cursor.map(mapping1);

        const mapping2 = (n: number) => n * 2;
        const cursor2 = cursor1.map(mapping2);

        assert.strictEqual(cursor2['_mapping']?.('i like cars'), 6);
      });
    });

    describe('clone', () => {
      it('should return a brand new cursor with the same config', () => {
        const allArbs = <const>[
          arbs.record(fc.anything()),
          arbs.record(fc.anything()),
          fc.func(fc.anything()),
          fc.array(fc.anything()),
          arbs.cursorState(),
          fc.nat(),
          fc.string(),
        ];

        fc.assert(
          fc.property(...allArbs, (filter, options, mapping, buffer, state, consumed, qs) => {
            const cursor = new CursorImpl(parent, null!, [filter, false], options, mapping);

            cursor['_nextPageState'] = new QueryState<string>().swap(qs);
            cursor['_buffer'] = buffer;
            cursor['_state'] = state;
            cursor['_consumed'] = consumed;

            CursorDeltaAsserter
              .captureImmutDelta(cursor, () => {
                return cursor.clone();
              })
              .assertDelta({
                _nextPageState: new QueryState(),
                _buffer: [],
                _state: 'idle',
                _consumed: 0,
              });
          }),
        );
      });
    });

    describe('$CustomInspect', () => {
      it('works', () => {
        fc.assert(
          fc.property(arbs.cursorState(), fc.nat(), fc.nat(), (state, consumed, buffered) => {
            const cursor = new CursorImpl(parent, null!, [{}, false]);
            cursor['_state'] = state;
            cursor['_consumed'] = consumed;
            cursor['_buffer'] = new Array(buffered);

            assert.strictEqual((cursor as any)[$CustomInspect](), `${CursorImpl.name}(source="${parent.keyspace}.${parent.name}",state="${state}",consumed=${consumed},buffered=${buffered})`);
          }),
        );
      });
    });
  });
};
