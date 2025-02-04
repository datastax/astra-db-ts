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
import { Camel2SnakeCase } from '@/src/lib/index.js';
import assert from 'assert';
import { CollSerDes } from '@/src/documents/collections/ser-des/ser-des.js';

describe('unit.documents.collections.ser-des.key-transformer', () => {
  describe('Camel2SnakeCase', () => {
    const serdes = new CollSerDes({ ...CollSerDes.cfg.empty, keyTransformer: new Camel2SnakeCase(), enableBigNumbers: () => 'bigint' });

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

    it('should allow for deep transformation', () => {
      const serdes = new CollSerDes({ ...CollSerDes.cfg.empty, keyTransformer: new Camel2SnakeCase({ transformNested: () => true }), enableBigNumbers: () => 'bigint' });

      const [obj] = serdes.serialize({
        camelCaseName1: 'dontChangeMe',
        camelCaseName2: [{ changeMe: 'dontChangeMe', meToo: { andMe: 'butNotMe' } }],
        camelCaseName3: { meAsWell: [{ andMe: { andMyAxe: 2n } }] },
      });

      assert.deepStrictEqual(obj, {
        camel_case_name1: 'dontChangeMe',
        camel_case_name2: [{ change_me: 'dontChangeMe', me_too: { and_me: 'butNotMe' } }],
        camel_case_name3: { me_as_well: [{ and_me: { and_my_axe: 2n } }] },
      });
    });

    it('should allow for explicit nested transformation when serializing', () => {
      const serdes = new CollSerDes({ ...CollSerDes.cfg.empty, keyTransformer: new Camel2SnakeCase({ transformNested: (ctx) => ctx.path.at(-1) !== '1' }), enableBigNumbers: () => 'bigint' });

      const [obj] = serdes.serialize({
        camelCaseName1: 'dontChangeMe',
        camelCaseName2: [{ '1': { butNotMe: 'norMe' }, changeMe: 'dontChangeMe' }],
        camelCaseName3: { meAsWell: [{ andMe: { andMyAxe: 2n } }, { sadlyNotMe: 'norMe' }] },
      });

      assert.deepStrictEqual(obj, {
        camel_case_name1: 'dontChangeMe',
        camel_case_name2: [{ '1': { butNotMe: 'norMe' }, change_me: 'dontChangeMe' }],
        camel_case_name3: { me_as_well: [{ and_me: { and_my_axe: 2n } }, { sadlyNotMe: 'norMe' }] },
      });
    });

    it('should allow for explicit nested transformation when deserializing', () => {
      const serdes = new CollSerDes({ ...CollSerDes.cfg.empty, keyTransformer: new Camel2SnakeCase({ transformNested: (ctx) => ctx.path[0] !== 'camelCaseName3' }), enableBigNumbers: () => 'bigint' });

      const obj = serdes.deserialize({
        camel_case_name1: 'dontChangeMe',
        camel_case_name2: [{ '1': { butNotMe: 'norMe' }, change_me: 'dontChangeMe' }],
        camel_case_name3: { me_as_well: [{ and_me: { and_my_axe: 2n } }, { sadlyNotMe: 'norMe' }] },
      }, {});

      assert.deepStrictEqual(obj, {
        camelCaseName1: 'dontChangeMe',
        camelCaseName2: [{ '1': { butNotMe: 'norMe' }, changeMe: 'dontChangeMe' }],
        camelCaseName3: { meAsWell: [{ andMe: { andMyAxe: 2n } }, { sadlyNotMe: 'norMe' }] },
      });
    });

    it('should allow for transforming _id', () => {
      const serdes = new CollSerDes({ ...CollSerDes.cfg.empty, keyTransformer: new Camel2SnakeCase({ exceptId: false }) });

      const [ser] = serdes.serialize({ _id: 'dontChangeMe' });
      assert.deepStrictEqual(ser, { _id: 'dontChangeMe' });

      const des = serdes.deserialize({ _id: 'dontChangeMe' }, { status: { projectionSchema: { _id: { type: 'ascii' } } } });
      assert.deepStrictEqual(des, { Id: 'dontChangeMe' });
    });
  });
});
