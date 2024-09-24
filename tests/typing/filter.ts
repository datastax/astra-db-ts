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

import type { Filter } from '@/src/documents/collections/types';
import type { ConvolutedSchema2, Schema } from '@/tests/typing/prelude';
import { SomeDoc } from '@/src/documents/collections';

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
      ],
    },
  ],
};

const test3: Filter<Schema> = {
  // @ts-expect-error - Invalid type
  num1: '1',
  num2: {
    $in: [
      1,
      2,
      // @ts-expect-error - Invalid type
      '3',
    ],
  },
  // Doesn't check nested types
  'obj.obj.num': '3',
  $and: [
    {
      num1: {
        // @ts-expect-error - Invalid type
        $eq: 1n,
      },
    }, {
      num2: {
        $in: [
          1,
          2,
          // @ts-expect-error - Invalid type
          '3',
        ],
      },
    }, {
      $or: [
        {
          'obj.obj.num': {
            // Doesn't check nested types
            $size: 3,
          },
        }, {
          'obj.obj.num': {
            // Doesn't check nested types
            $and: [],
          },
        }, {
          num1: {
            // @ts-expect-error - Invalid op
            $size: 3,
          },
        },
      ],
    },
  ],
};

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
      ],
    },
  ],
};

const test5: Filter<Schema> = {
  // Doesn't check nested paths
  'obj.obj.xyz': null!,
};

const test6: Filter<ConvolutedSchema2> = {
  $or: [
    { numOrArray: { $in: [['1'], 2] } },
    { numOrArray: { $gte: 3 } },
    { numOrArray: { $size: 3 } },
  ],
};

const test7: Filter<any> = {
  $and: [
    { $or: [] },
    { $not: { $and: [ { 'some_random_key': Symbol.for('123') } ] } },
  ],
  '123123123': 123123,
};

const test8: Filter<any> = {
  // @ts-expect-error - Invalid type
  $and: 3,
};
