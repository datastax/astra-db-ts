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

import { describe } from '@/tests/testlib';
import { Camel2SnakeCase } from '@/src/lib';
import assert from 'assert';
import { TableSerDes } from '@/src/documents/tables/ser-des/ser-des';
import { CollectionSerDes } from '@/src/documents/collections/ser-des/ser-des';

describe('unit.documents.table.ser-des.key-transformer', () => {
  const ctx = { path: [''] } as any;

  describe('Camel2SnakeCase', () => {
    const snakeCase = new Camel2SnakeCase();
    const tableSerdes = new TableSerDes({ keyTransformer: snakeCase });
    const collSerdes = new CollectionSerDes({ keyTransformer: snakeCase });

    it('should serialize strings to snake_case', () => {
      assert.strictEqual(snakeCase.serializeKey('camelCaseName', ctx), 'camel_case_name');
      assert.strictEqual(snakeCase.serializeKey('CamelCaseName', ctx), '_camel_case_name');
      assert.strictEqual(snakeCase.serializeKey('_camelCaseName', ctx), '_camel_case_name');
      assert.strictEqual(snakeCase.serializeKey('_CamelCaseName', ctx), '__camel_case_name');
      assert.strictEqual(snakeCase.serializeKey('camelCaseName_', ctx), 'camel_case_name_');
      assert.strictEqual(snakeCase.serializeKey('car', ctx), 'car');
    });

    it('should deserialize strings to camelCase', () => {
      assert.strictEqual(snakeCase.deserializeKey('snake_case_name', ctx), 'snakeCaseName');
      assert.strictEqual(snakeCase.deserializeKey('_snake_case_name', ctx), 'SnakeCaseName');
      assert.strictEqual(snakeCase.deserializeKey('__snake_case_name', ctx), '_SnakeCaseName');
      assert.strictEqual(snakeCase.deserializeKey('snake_case_name_', ctx), 'snakeCaseName_');
      assert.strictEqual(snakeCase.deserializeKey('car', ctx), 'car');
    });

    it('should serialize top-level keys to snake_case for tables', () => {
      const [obj, bigNumPresent] = tableSerdes.serialize({
        camelCaseName: 'dontChangeMe',
        CamelCaseName: ['dontChangeMe'],
        _camelCaseName: { dontChangeMe: 'dontChangeMe' },
        _CamelCaseName: new Map([['dontChangeMe', 'dontChangeMe']]),
        camelCaseName_: 1n,
        car: new Set(['dontChangeMe']),
      });

      assert.deepStrictEqual(obj, {
        camel_case_name: 'dontChangeMe',
        __camel_case_name: { dontChangeMe: 'dontChangeMe' },
        _camel_case_name: ['dontChangeMe'],
        camel_case_name_: 1n,
        car: ['dontChangeMe'],
      });
      assert.strictEqual(bigNumPresent, true);
    });

    it('should deserialize top-level keys to camelCase for tables', () => {
      const obj = tableSerdes.deserialize({
        camel_case_name: 'dontChangeMe',
        __camel_case_name: { dontChangeMe: 'dontChangeMe' },
        _camel_case_name: ['dontChangeMe'],
        camel_case_name_: 1n,
        car: ['dontChangeMe'],
      }, {
        status: {
          projectionSchema: {
            camel_case_name: { type: 'text' },
            __camel_case_name: { type: 'map', keyType: 'text', valueType: 'text' },
            _camel_case_name: { type: 'list', valueType: 'text' },
            camel_case_name_: { type: 'varint' },
            car: { type: 'set', valueType: 'text' },
          },
        },
      });

      assert.deepStrictEqual(obj, {
        camelCaseName: 'dontChangeMe',
        CamelCaseName: ['dontChangeMe'],
        _CamelCaseName: new Map([['dontChangeMe', 'dontChangeMe']]),
        camelCaseName_: 1n,
        car: new Set(['dontChangeMe']),
      });
    });

    it('should deserialize top-level keys to camelCase for tables for primary keys', () => {
      const obj = tableSerdes.deserialize([
        'dontChangeMe',
        { dontChangeMe: 'dontChangeMe' },
        ['dontChangeMe'],
        1n,
        ['dontChangeMe'],
      ], {
        status: {
          primaryKeySchema: {
            camel_case_name: { type: 'text' },
            __camel_case_name: { type: 'map', keyType: 'text', valueType: 'text' },
            _camel_case_name: { type: 'list', valueType: 'text' },
            camel_case_name_: { type: 'varint' },
            car: { type: 'set', valueType: 'text' },
          },
        },
      }, true);

      assert.deepStrictEqual(obj, {
        camelCaseName: 'dontChangeMe',
        CamelCaseName: ['dontChangeMe'],
        _CamelCaseName: new Map([['dontChangeMe', 'dontChangeMe']]),
        camelCaseName_: 1n,
        car: new Set(['dontChangeMe']),
      });
    });

    it('should serialize top-level keys to snake_case for collections', () => {
      const [obj] = collSerdes.serialize({
        camelCaseName: 'dontChangeMe',
        CamelCaseName: ['dontChangeMe'],
        _camelCaseName: { dontChangeMe: 'dontChangeMe' },
        _CamelCaseName: { dontChangeMe: 'dontChangeMe' },
        camelCaseName_: 1n,
        car: ['dontChangeMe'],
      });

      assert.deepStrictEqual(obj, {
        camel_case_name: 'dontChangeMe',
        __camel_case_name: { dontChangeMe: 'dontChangeMe' },
        _camel_case_name: ['dontChangeMe'],
        camel_case_name_: 1n,
        car: ['dontChangeMe'],
      });
    });

    it('should deserialize top-level keys to camelCase for collections', () => {
      const obj = collSerdes.deserialize({
        camel_case_name: 'dontChangeMe',
        __camel_case_name: { dontChangeMe: 'dontChangeMe' },
        _camel_case_name: ['dontChangeMe'],
        camel_case_name_: 1n,
        car: [['dontChangeMe']],
      }, {});

      assert.deepStrictEqual(obj, {
        camelCaseName: 'dontChangeMe',
        CamelCaseName: ['dontChangeMe'],
        _CamelCaseName: { dontChangeMe: 'dontChangeMe' },
        camelCaseName_: 1n,
        car: [['dontChangeMe']],
      });
    });
  });
});
