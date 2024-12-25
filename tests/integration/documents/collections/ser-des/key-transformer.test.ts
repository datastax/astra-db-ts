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
  $DeserializeForCollection,
  $SerializeForCollection,
  CollCodec,
  CollCodecs,
  CollDesCtx,
  CollSerCtx,
  uuid,
  UUID,
} from '@/src/index';

describe('integration.documents.collections.ser-des.key-transformer', ({ db }) => {
  class Newtype implements CollCodec<typeof Newtype> {
    constructor(public dontChange_me: string) {}

    [$SerializeForCollection](ctx: CollSerCtx) {
      return ctx.done(this.dontChange_me);
    }

    static [$DeserializeForCollection](_: unknown, value: string, ctx: CollDesCtx) {
      return ctx.done(new Newtype(value));
    }
  }

  describe('Camel2SnakeCase', { drop: 'colls:after' }, () => {
    interface SnakeCaseTest {
      _id: UUID,
      camelCase1: string,
      camelCaseName2: Newtype,
      CamelCaseName3: string[],
      _CamelCaseName4: Record<string, string>,
      camelCaseName5_: bigint,
      name: string[],
    }

    const coll = useSuiteResources(() => ({
      ref: db.createCollection<SnakeCaseTest>('test_camel_snake_case_coll', {
        serdes: {
          keyTransformer: new Camel2SnakeCase(),
          codecs: [CollCodecs.forName('camelCaseName2', Newtype)],
          enableBigNumbers: true,
        },
      }),
    }));

    it('should work', async () => {
      const id = uuid(4);

      const { insertedId } = await coll.ref.insertOne({
        _id: id,
        camelCase1: 'dontChange_me',
        camelCaseName2: new Newtype('dontChange_me'),
        CamelCaseName3: ['dontChange_me'],
        _CamelCaseName4: { dontChange_me: 'dontChange_me' },
        camelCaseName5_: 123n,
        name: ['dontChange_me'],
      });

      assert.deepStrictEqual(insertedId, id);

      const result = await coll.ref.findOne({ _id: insertedId });

      assert.deepStrictEqual(result, {
        _id: id,
        camelCase1: 'dontChange_me',
        camelCaseName2: new Newtype('dontChange_me'),
        CamelCaseName3: ['dontChange_me'],
        _CamelCaseName4: { dontChange_me: 'dontChange_me' },
        camelCaseName5_: 123,
        name: ['dontChange_me'],
      });
    });
  });
});
