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

import { describe, it, useSuiteResources } from '@/tests/testlib';
import { Camel2SnakeCase } from '@/src/lib';
import assert from 'assert';
import {
  $DeserializeForTable,
  $SerializeForTable,
  TableCodec,
  TableCodecs,
  TableDesCtx,
  TableSerCtx,
} from '@/src/index';

describe('integration.documents.tables.ser-des.key-transformer', ({ db }) => {
  class Newtype implements TableCodec<typeof Newtype> {
    constructor(public dontChange_me: string) {}

    [$SerializeForTable](ctx: TableSerCtx) {
      return ctx.done(this.dontChange_me);
    }

    static [$DeserializeForTable](_: unknown, value: string, ctx: TableDesCtx) {
      return ctx.done(new Newtype(value));
    }
  }

  describe('Camel2SnakeCase', { drop: 'tables:after' }, () => {
    interface SnakeCaseTest {
      camelCase1: string,
      camelCaseName2: Newtype,
      CamelCaseName3: string[],
      _CamelCaseName4: Map<string, string>,
      camelCaseName5_: bigint,
      name: Set<string>,
    }

    const table = useSuiteResources(() => ({
      ref: db.createTable<SnakeCaseTest>('test_camel_snake_case_table', {
        definition: {
          columns: {
            camel_case1: 'text',
            camel_case_name2: 'text',
            _camel_case_name3: { type: 'list', valueType: 'text' },
            __camel_case_name4: { type: 'map', keyType: 'text', valueType: 'text' },
            camel_case_name5_: 'varint',
            name: { type: 'set', valueType: 'text' },
            never_set: 'text',
          },
          primaryKey: {
            partitionBy: ['camel_case1', 'camel_case_name2', 'camel_case_name5_'],
          },
        },
        serdes: {
          keyTransformer: new Camel2SnakeCase(),
          codecs: [TableCodecs.forName('camelCaseName2', Newtype)],
        },
      }),
    }));

    it('should work', async () => {
      const { insertedId } = await table.ref.insertOne({
        camelCase1: 'dontChange_me',
        camelCaseName2: new Newtype('dontChange_me'),
        CamelCaseName3: ['dontChange_me'],
        _CamelCaseName4: new Map([['dontChange_me', 'dontChange_me']]),
        camelCaseName5_: 123n,
        name: new Set(['dontChange_me']),
      });

      assert.deepStrictEqual(insertedId, {
        camelCase1: 'dontChange_me',
        camelCaseName2: new Newtype('dontChange_me'),
        camelCaseName5_: 123n,
      });

      const result = await table.ref.findOne(insertedId);

      assert.deepStrictEqual(result, {
        camelCase1: 'dontChange_me',
        camelCaseName2: new Newtype('dontChange_me'),
        CamelCaseName3: ['dontChange_me'],
        _CamelCaseName4: new Map([['dontChange_me', 'dontChange_me']]),
        camelCaseName5_: 123n,
        name: new Set(['dontChange_me']),
        neverSet: null,
      });
    });
  });
});
