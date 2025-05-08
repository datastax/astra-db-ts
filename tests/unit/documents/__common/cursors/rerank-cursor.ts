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

import type {
  CollectionFindAndRerankCursor,
  FindAndRerankCursor,
  HybridSort,
  TableFindAndRerankCursor,
} from '@/src/documents/index.js';
import { CursorError, RerankedResult } from '@/src/documents/index.js';
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
  CursorImpl: typeof CollectionFindAndRerankCursor | typeof TableFindAndRerankCursor,
  serdes: SerDes,
}

const CursorDeltaAsserter = new DeltaAsserter([], AbstractCursorDeltaAsserter);
const CursorInternalDeltaAsserter = new DeltaAsserter(['_filter', '_serdes', '_parent', '_options', '_httpClient']);

export const unitTestRerankCursor = ({ CursorImpl, parent, ...cfg }: FindCursorTestConfig) => {
  unitTestAbstractCursor({ CursorImpl, parent, DeltaAsserter: CursorDeltaAsserter });

  describe('misc', () => {
    it('should throw an error when calling a builder method on a non-idle cursor', () => {
      const properties = <const>['filter', 'sort', 'limit', 'project', 'hybridLimits', 'rerankOn', 'map'] satisfies (keyof FindAndRerankCursor<unknown>)[];

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
              .captureImmutDelta(cursor._internal, () => cursor.sort(sort as HybridSort)._internal)
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

    describe('hybridLimits', () => {
      it('should create a new cursor with new hybrid limits', () => {
        fc.assert(
          fc.property(fc.oneof(fc.nat(), arbs.record(fc.nat())), arbs.record(fc.anything()), (limits, oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);

            CursorInternalDeltaAsserter
              .captureImmutDelta(cursor._internal, () => cursor.hybridLimits(limits)._internal)
              .assertDelta({ _options: { ...oldOptions, hybridLimits: limits } });
          }),
        );
      });
    });

    describe('rerankOn', () => {
      it('should create a new cursor with new rerankOn configuration', () => {
        fc.assert(
          fc.property(fc.string(), arbs.record(fc.anything()), (rerankField, oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);

            CursorInternalDeltaAsserter
              .captureImmutDelta(cursor._internal, () => cursor.rerankOn(rerankField)._internal)
              .assertDelta({ _options: { ...oldOptions, rerankOn: rerankField } });
          }),
        );
      });
    });

    describe('rerankQuery', () => {
      it('should create a new cursor with new rerankQuery configuration', () => {
        fc.assert(
          fc.property(fc.string(), arbs.record(fc.anything()), (rerankQuery, oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);

            CursorInternalDeltaAsserter
              .captureImmutDelta(cursor._internal, () => cursor.rerankQuery(rerankQuery)._internal)
              .assertDelta({ _options: { ...oldOptions, rerankQuery: rerankQuery } });
          }),
        );
      });
    });

    describe('includeScores', () => {
      it('should create a new cursor with new includeScores configuration', () => {
        fc.assert(
          fc.property(fc.boolean(), arbs.record(fc.anything()), (includeScores, oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);

            CursorInternalDeltaAsserter
              .captureImmutDelta(cursor._internal, () => cursor.includeScores(includeScores)._internal)
              .assertDelta({ _options: { ...oldOptions, includeScores: includeScores } });
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
          fc.array(fc.anything().map((x) => new RerankedResult(x, {}))),
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
