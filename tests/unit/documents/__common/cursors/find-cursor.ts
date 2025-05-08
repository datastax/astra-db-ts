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
import { $CustomInspect } from '@/src/lib/constants.js';
import { SerDesTarget } from '@/src/lib/index.js';

interface FindCursorTestConfig extends Omit<AbstractCursorTestConfig, 'DeltaAsserter'> {
  CursorImpl: typeof CollectionFindCursor | typeof TableFindCursor,
  serdes: SerDes,
}

const CursorDeltaAsserter = new DeltaAsserter([], AbstractCursorDeltaAsserter);
const CursorInternalDeltaAsserter = new DeltaAsserter(['_filter', '_serdes', '_parent', '_options', '_httpClient']);

export const unitTestFindCursor = ({ CursorImpl, parent, ...cfg }: FindCursorTestConfig) => {
  unitTestAbstractCursor({ CursorImpl, parent, DeltaAsserter: CursorInternalDeltaAsserter });

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

        CursorInternalDeltaAsserter
          .captureImmutDelta(cursor._internal, () => cursor.filter({ uuid })._internal)
          .assertDelta({ _filter: newFilter });
      });
    });

    describe('sort', () => {
      it('should create a new cursor with a new pre-serialized sort', () => {
        fc.assert(
          fc.property(arbs.record(fc.anything()), arbs.record(fc.anything()), (sort, oldOptions) => {
            const cursor = new CursorImpl(parent, cfg.serdes, [{}, false], oldOptions);

            const newSort = cfg.serdes.serialize(sort, SerDesTarget.Sort)[0];

            CursorInternalDeltaAsserter
              .captureImmutDelta(cursor._internal, () => cursor.sort(sort as Sort)._internal)
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

            CursorInternalDeltaAsserter
              .captureImmutDelta(cursor._internal, () => cursor.limit(limit)._internal)
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

            CursorInternalDeltaAsserter
              .captureImmutDelta(cursor._internal, () => cursor.skip(skip)._internal)
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

            CursorInternalDeltaAsserter
              .captureImmutDelta(cursor._internal, () => cursor.project(projection)._internal)
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

            CursorInternalDeltaAsserter
              .captureImmutDelta(cursor._internal, () => cursor.includeSimilarity(include)._internal)
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

            CursorInternalDeltaAsserter
              .captureImmutDelta(cursor._internal, () => cursor.includeSortVector(include)._internal)
              .assertDelta({ _options: { ...oldOptions, includeSortVector: include ?? true } });
          }),
        );
      });
    });

    describe('initialPageState', () => {
      it('should create a new cursor with the initial page state set if a string', () => {
        fc.assert(
          fc.property(fc.string(), arbs.record(fc.anything()), (pageState, oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);

            CursorDeltaAsserter
              .captureImmutDelta(cursor, () => cursor.initialPageState(pageState))
              .assertDelta({ _currentPage: { nextPageState: pageState, result: [] } });
          }),
        );
      });

      it('should create a new cursor with the initial page state unset if undefined', () => {
        fc.assert(
          fc.property(fc.string(), arbs.record(fc.anything()), (garbagePageState, oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);
            cursor['_currentPage'] = { nextPageState: 'some-page-state', result: [] };

            CursorDeltaAsserter
              .captureImmutDelta(cursor, () => cursor.initialPageState(garbagePageState).initialPageState(undefined))
              .assertDelta({ _currentPage: undefined });
          }),
        );
      });

      it('should error if initialPageState is null', () => {
        fc.assert(
          fc.property(arbs.record(fc.anything()), (oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);

            assert.throws(() => cursor.initialPageState(null!), (e) => {
              return e instanceof CursorError && e.message.includes('Cannot set an initial page state to `null`');
            });
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

            cursor['_currentPage'] = { nextPageState: qs, result: buffer };
            cursor['_state'] = state;
            cursor['_consumed'] = consumed;

            CursorDeltaAsserter
              .captureImmutDelta(cursor, () => {
                return cursor.clone();
              })
              .assertDelta({
                _currentPage: undefined,
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
            cursor['_currentPage'] = { nextPageState: null, result: new Array(buffered) };

            assert.strictEqual((cursor as any)[$CustomInspect](), `${CursorImpl.name}(source="${parent.keyspace}.${parent.name}",state="${state}",consumed=${consumed},buffered=${buffered})`);
          }),
        );
      });
    });
  });
};
