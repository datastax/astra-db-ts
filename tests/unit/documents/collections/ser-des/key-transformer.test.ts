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
import { CollectionSerDes } from '@/src/documents/collections/ser-des/ser-des';

describe('unit.documents.collections.ser-des.key-transformer', () => {
  describe('Camel2SnakeCase', () => {
    const serdes = new CollectionSerDes({ keyTransformer: new Camel2SnakeCase(), enableBigNumbers: () => 'bigint' });

    it('should serialize top-level keys to snake_case for collections', () => {
      const [obj] = serdes.serialize({
        _id: 'dontChangeMe',
        camelCaseName1: 'dontChangeMe',
        CamelCaseName2: ['dontChangeMe'],
        _camelCaseName3: { dontChangeMe: 'dontChangeMe' },
        _CamelCaseName4: { dontChangeMe: 'dontChangeMe' },
        camelCaseName_5: 1n,
        car: ['dontChangeMe'],
      });

      assert.deepStrictEqual(obj, {
        _id: 'dontChangeMe',
        camel_case_name1: 'dontChangeMe',
        _camel_case_name2: ['dontChangeMe'],
        _camel_case_name3: { dontChangeMe: 'dontChangeMe' },
        __camel_case_name4: { dontChangeMe: 'dontChangeMe' },
        camel_case_name_5: 1n,
        car: ['dontChangeMe'],
      });
    });

    it('should deserialize top-level keys to camelCase for collections', () => {
      const obj = serdes.deserialize({
        _id: 'dontChangeMe',
        camel_case_name1: 'dontChangeMe',
        __camel_case_name2: { dontChangeMe: 'dontChangeMe' },
        _camel_case_name3: ['dontChangeMe'],
        camel_case_name_4: 1n,
        car: [['dontChangeMe']],
      }, {});

      assert.deepStrictEqual(obj, {
        _id: 'dontChangeMe',
        camelCaseName1: 'dontChangeMe',
        _CamelCaseName2: { dontChangeMe: 'dontChangeMe' },
        CamelCaseName3: ['dontChangeMe'],
        camelCaseName_4: 1n,
        car: [['dontChangeMe']],
      });
    });
  });
});
