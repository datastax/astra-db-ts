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

/* eslint-disable @typescript-eslint/no-unused-vars */

import { ConvolutedSchema2, Equal, Expect, Schema, SuperBasicSchema } from '@/tests/typing/prelude';
import { Filter, SomeDoc } from '@/src/client';

type test1 = Expect<Equal<Filter<SuperBasicSchema>, {
  num?: number | {
    $eq?: number,
    $ne?: number,
    $in?: number[],
    $nin?: number[],
    $exists?: boolean,
  } & {
    $lt?: number | bigint,
    $lte?: number | bigint,
    $gt?: number | bigint,
    $gte?: number | bigint,
  },
  obj?: { str: string } | {
    $eq?: { str: string },
    $ne?: { str: string },
    $in?: { str: string }[],
    $nin?: { str: string }[],
    $exists?: boolean,
  },
  'obj.str'?: string | {
    $eq?: string,
    $ne?: string,
    $in?: string[],
    $nin?: string[],
    $exists?: boolean,
  },
} & {
  _id?: string | {
    $eq?: string,
    $ne?: string,
    $in?: string[],
    $nin?: string[],
    $exists?: boolean,
  },
  $and?: Filter<SuperBasicSchema>[],
  $or?: Filter<SuperBasicSchema>[],
  $not?: Filter<SuperBasicSchema>,
}>>;

const test2: Filter<Schema> = {
  num1: 1,
  num2: { $in: [1, 2, 3] },
  'obj.obj.num': 3,
  $and: [
    { num1: { $eq: 1 } },
    { num2: { $in: [1, 2, 3] } },
    { 'obj.obj.any.xyz': { $nin: [1, '2', 3] } },
    {
      $or: [
        { 'obj.obj.num': { $exists: true } },
        { 'obj.obj.any': { $gt: 1 } },
      ]
    }
  ],
}

const test3: Filter<Schema> = {
  // @ts-expect-error - Invalid type
  num1: '1',
  num2: {
    $in: [
      1,
      2,
      // @ts-expect-error - Invalid type
      '3',
    ]
  },
  // @ts-expect-error - Invalid type
  'obj.obj.num': '3',
  $and: [
    {
      num1: {
        // @ts-expect-error - Invalid type
        $eq: 1n
      }
    }, {
      num2: {
        $in: [
          1,
          2,
          // @ts-expect-error - Invalid type
          '3',
        ]
      }
    }, {
      $or: [
        {
          'obj.obj.num': {
            // @ts-expect-error - Invalid op
            $size: 3
          }
        }, {
          'obj.obj.num': {
            // @ts-expect-error - Invalid op
            $and: []
          }
        }
      ]
    }
  ]
}

const test4: Filter<SomeDoc> = {
  num1: '1',
  num2: { $in: [1, 2, '3'] },
  'obj.obj.num': '3',
  $and: [
    { num1: { $eq: 1n } },
    { num2: { $in: [1, 2, '3'] } },
    {
      $or: [
        { 'obj.obj.num': { $size: 3 } },
        { 'obj.obj.num': { $and: [] } },
      ]
    }
  ]
}

const test5: Filter<Schema> = {
  // @ts-expect-error - Invalid path
  'obj.obj.xyz': null!
}

const test6: Filter<ConvolutedSchema2> = {
  $or: [
    { numOrArray: { $in: [['1'], 2] } },
    { numOrArray: { $gte: 3 } },
    { numOrArray: { $size: 3 } },
  ]
}
