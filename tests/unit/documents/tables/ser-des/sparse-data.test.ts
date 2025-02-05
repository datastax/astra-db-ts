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

import { describe, it } from '@/tests/testlib/index.js';
import assert from 'assert';
import { TableSerDes } from '@/src/documents/tables/ser-des/ser-des.js';

describe('unit.documents.tables.ser-des.sparse-data', () => {
  const schema = {
    int: { type: 'int' },
    text: { type: 'text' },
    map: { type: 'map', keyType: 'text', valueType: 'text' },
    set: { type: 'set', valueType: 'text' },
    list: { type: 'list', valueType: 'text' },
  };

  describe('sparseData: true', () => {
    const serdes = new TableSerDes({ ...TableSerDes.cfg.empty, sparseData: true });

    it('should leave populated fields populated', () => {
      const resp = serdes.deserialize({
        int: 1,
        text: 'text',
        map: { key: 'value' },
        set: ['value'],
        list: ['value'],
      }, {
        status: { projectionSchema: schema },
      });

      assert.deepStrictEqual(resp, {
        int: 1,
        text: 'text',
        map: new Map([['key', 'value']]),
        set: new Set(['value']),
        list: ['value'],
      });
    });

    it('should not populated unpopulated fields', () => {
      const resp = serdes.deserialize({}, {
        status: { projectionSchema: schema },
      });
      assert.deepStrictEqual(resp, {});
    });
  });

  describe('sparseData: false', () => {
    const serdes = new TableSerDes({ ...TableSerDes.cfg.empty, sparseData: false });

    it('should populate all fields', () => {
      const resp = serdes.deserialize({}, {
        status: { projectionSchema: schema },
      });
      assert.deepStrictEqual(resp, {
        int: null,
        text: null,
        map: new Map(),
        set: new Set(),
        list: [],
      });
    });
  });
});
