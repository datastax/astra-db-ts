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

import { UUID, ObjectId } from '@/src/documents';
import { describe, it } from '@/tests/testlib';
import assert from 'assert';
import { replacer, reviver } from '@/src/lib/api/clients/data-api-http-client';

describe('unit.lib.api.clients.documents-http-client', () => {
  describe('replacer tests', () => {
    it('works', () => {
      const actual = JSON.stringify({
        bigInt: 9007199254740991n,
        date: new Date('2021-01-01'),
        _id: new ObjectId('5f5b9e6e8b1d8f001f6b3b3d'),
        nested: {
          uuid: new UUID('123e4567-e89b-12d3-a456-426614174000'),
          date: { $date: new Date('2021-01-01').valueOf() },
        },
        array: [new UUID('123e4567-e89b-12d3-a456-426614174000'), new ObjectId('5f5b9e6e8b1d8f001f6b3b3d')],
        car: {
          bus: [{ train: { $date: new Date('2021-01-01') } }],
        },
      }, replacer);

      const expected = JSON.stringify({
        bigInt: Number(9007199254740991n),
        date: { $date: new Date('2021-01-01').valueOf() },
        _id: { $objectId: '5f5b9e6e8b1d8f001f6b3b3d' },
        nested: {
          uuid: { $uuid: '123e4567-e89b-12d3-a456-426614174000' },
          date: { $date: new Date('2021-01-01').valueOf() },
        },
        array: [{ $uuid: '123e4567-e89b-12d3-a456-426614174000' }, { $objectId: '5f5b9e6e8b1d8f001f6b3b3d' }],
        car: {
          bus: [{ train: { $date: new Date('2021-01-01').valueOf() } }],
        },
      });

      assert.strictEqual(actual, expected);
    });
  });

  describe('reviver tests', () => {
    it('works', () => {
      const actual = <unknown>JSON.parse(JSON.stringify({
        bigInt: Number(9007199254740991n),
        date: { $date: new Date('2021-01-01').valueOf() },
        _id: { $objectId: '5f5b9e6e8b1d8f001f6b3b3d' },
        nested: {
          uuid: { $uuid: '123e4567-e89b-12d3-a456-426614174000' },
          date: { $date: new Date('2021-01-01').valueOf() },
        },
        array: [{ $uuid: '123e4567-e89b-12d3-a456-426614174000' }, { $objectId: '5f5b9e6e8b1d8f001f6b3b3d' }],
        car: {
          bus: [{ train: { $date: new Date('2021-01-01') } }],
        },
      }), reviver);

      const expected = {
        bigInt: 9007199254740991,
        date: new Date('2021-01-01'),
        _id: new ObjectId('5f5b9e6e8b1d8f001f6b3b3d'),
        nested: {
          uuid: new UUID('123e4567-e89b-12d3-a456-426614174000'),
          date: new Date('2021-01-01'),
        },
        array: [new UUID('123e4567-e89b-12d3-a456-426614174000'), new ObjectId('5f5b9e6e8b1d8f001f6b3b3d')],
        car: {
          bus: [{ train: new Date('2021-01-01') }],
        },
      };

      assert.deepStrictEqual(actual, expected);
    });
  });
});
