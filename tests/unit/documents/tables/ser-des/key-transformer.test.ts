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

import { describe, it } from '@/tests/testlib';
import { Camel2SnakeCase } from '@/src/lib';
import assert from 'assert';
import { TableSerDes } from '@/src/documents/tables/ser-des/ser-des';

describe('unit.documents.tables.ser-des.key-transformer', () => {
  describe('Camel2SnakeCase', () => {
    const serdes = new TableSerDes({ keyTransformer: new Camel2SnakeCase() });

    it('should serialize top-level keys to snake_case for tables', () => {
      const [obj, bigNumPresent] = serdes.serialize({
        camelCaseName1: 'dontChangeMe',
        CamelCaseName2: ['dontChangeMe'],
        _camelCaseName3: { dontChangeMe: 'dontChangeMe' },
        _CamelCaseName4: new Map([['dontChangeMe', 'dontChangeMe']]),
        camelCaseName_5: 1n,
        car: new Set(['dontChangeMe']),
      });

      assert.deepStrictEqual(obj, {
        camel_case_name1: 'dontChangeMe',
        _camel_case_name2: ['dontChangeMe'],
        _camel_case_name3: { dontChangeMe: 'dontChangeMe' },
        __camel_case_name4: { dontChangeMe: 'dontChangeMe' },
        camel_case_name_5: 1n,
        car: ['dontChangeMe'],
      });
      assert.strictEqual(bigNumPresent, true);
    });

    it('should deserialize top-level keys to camelCase for tables', () => {
      const obj = serdes.deserialize({
        camel_case_name1: 'dontChangeMe',
        __camel_case_name2: { dontChangeMe: 'dontChangeMe' },
        _camel_case_name3: ['dontChangeMe'],
        camel_case_name_4: 1n,
        car: ['dontChangeMe'],
      }, {
        status: {
          projectionSchema: {
            camel_case_name1: { type: 'text' },
            __camel_case_name2: { type: 'map', keyType: 'text', valueType: 'text' },
            _camel_case_name3: { type: 'list', valueType: 'text' },
            camel_case_name_4: { type: 'varint' },
            car: { type: 'set', valueType: 'text' },
          },
        },
      });

      assert.deepStrictEqual(obj, {
        camelCaseName1: 'dontChangeMe',
        _CamelCaseName2: new Map([['dontChangeMe', 'dontChangeMe']]),
        CamelCaseName3: ['dontChangeMe'],
        camelCaseName_4: 1n,
        car: new Set(['dontChangeMe']),
      });
    });

    it('should deserialize top-level keys to camelCase for tables for primary keys', () => {
      const obj = serdes.deserialize([
        'dontChangeMe',
        { dontChangeMe: 'dontChangeMe' },
        ['dontChangeMe'],
        1n,
        ['dontChangeMe'],
      ], {
        status: {
          primaryKeySchema: {
            camel_case_name1: { type: 'text' },
            __camel_case_name2: { type: 'map', keyType: 'text', valueType: 'text' },
            _camel_case_name3: { type: 'list', valueType: 'text' },
            camel_case_name_4: { type: 'varint' },
            car: { type: 'set', valueType: 'text' },
          },
        },
      }, true);

      assert.deepStrictEqual(obj, {
        camelCaseName1: 'dontChangeMe',
        _CamelCaseName2: new Map([['dontChangeMe', 'dontChangeMe']]),
        CamelCaseName3: ['dontChangeMe'],
        camelCaseName_4: 1n,
        car: new Set(['dontChangeMe']),
      });
    });
  });
});
