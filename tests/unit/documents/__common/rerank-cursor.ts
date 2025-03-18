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
  RerankResult,
  TableFindAndRerankCursor,
} from '@/src/documents/index.js';
import { CursorError } from '@/src/documents/index.js';
import type { AbstractCursorTestConfig } from '@/tests/unit/documents/__common/abstract-cursor.js';
import {
  AbstractCursorDeltaAsserter,
  unitTestAbstractCursor,
} from '@/tests/unit/documents/__common/abstract-cursor.js';
import { DeltaAsserter } from '@/tests/testlib/utils.js';
import fc from 'fast-check';
import { arbs } from '@/tests/testlib/arbitraries.js';
import assert from 'assert';
import { describe, it } from '@/tests/testlib/index.js';
import { UUID } from '@/src/documents/datatypes/uuid.js';
import type { SerDes } from '@/src/lib/api/ser-des/ser-des.js';
import { QueryState } from '@/src/lib/utils.js';
import { $CustomInspect } from '@/src/lib/constants.js';

interface FindCursorTestConfig extends Omit<AbstractCursorTestConfig, 'DeltaAsserter'> {
  CursorImpl: typeof CollectionFindAndRerankCursor | typeof TableFindAndRerankCursor,
  serdes: SerDes,
}

const CursorDeltaAsserter = new DeltaAsserter(['_serdes', '_parent', '_filter'], AbstractCursorDeltaAsserter);

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

        CursorDeltaAsserter
          .captureImmutDelta(cursor, () => cursor.filter({ uuid }))
          .assertDelta({ _filter: cfg.serdes.serialize({ uuid }) });
      });
    });

    describe('sort', () => {
      it('should create a new cursor with a new sort', () => {
        fc.assert(
          fc.property(arbs.record(fc.anything()), arbs.record(fc.anything()), (sort, oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);

            CursorDeltaAsserter
              .captureImmutDelta(cursor, () => cursor.sort(sort as HybridSort))
              .assertDelta({ _options: { ...oldOptions, sort } });
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

    describe('hybridLimits', () => {
      it('should create a new cursor with new hybrid limits', () => {
        fc.assert(
          fc.property(fc.oneof(fc.nat(), arbs.record(fc.nat())), arbs.record(fc.anything()), (limits, oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);

            CursorDeltaAsserter
              .captureImmutDelta(cursor, () => cursor.hybridLimits(limits))
              .assertDelta({ _options: { ...oldOptions, hybridLimits: limits } });
          }),
        );
      });
    });

    describe('rerankOn', () => {
      it('should create a new cursor with sort vector included', () => {
        fc.assert(
          fc.property(fc.string(), arbs.record(fc.anything()), (rerankField, oldOptions) => {
            const cursor = new CursorImpl(parent, null!, [{}, false], oldOptions);

            CursorDeltaAsserter
              .captureImmutDelta(cursor, () => cursor.rerankOn(rerankField))
              .assertDelta({ _options: { ...oldOptions, rerankOn: rerankField } });
          }),
        );
      });
    });

    describe('map', () => {
      it('should create a new cursor by composting mappings', () => {
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
            cursor['_buffer'] = buffer as RerankResult<any>[];
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
