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

import { SomeDoc, StrictUpdateFilter } from '@/src/client/index';
import { BasicSchema, ConvolutedSchema1, ConvolutedSchema2, Equal, Expect, Schema } from '@/tests/typing/prelude';
import { ToDotNotation } from '@/src/client/types/dot-notation';

type test1 = Expect<Equal<StrictUpdateFilter<BasicSchema>, {
  $set?: {
    num?: number,
    str?: string,
    any?: any,
    [k: `any.${string}`]: any,
    'obj.str'?: string,
    obj?: { str: string },
  },
  $setOnInsert?: {
    num?: number,
    str?: string,
    any?: any,
    [k: `any.${string}`]: any,
    'obj.str'?: string,
    obj?: { str: string },
  },
  $unset?: Partial<{
    num: '',
    str: '',
    any: '',
    [k: `any.${string}`]: '',
    'obj.str': '',
    obj: '',
  }>,
  $inc?: Partial<{
    num: number | bigint,
    [k: `any.${string}`]: number | bigint,
    any: number | bigint,
  }>,
  $push?: Partial<{
    [k: `any.${string}`]: unknown,
    any: unknown,
  }>,
  $pop?: Partial<{
    [k: `any.${string}`]: number,
    any: number,
  }>,
  $rename?: Partial<{
    num: string,
    str: string,
    any: string,
    [k: `any.${string}`]: string,
    'obj.str': string,
    obj: string,
  }>,
  $currentDate?: Partial<NonNullable<unknown>>,
  $min?: Partial<{
    num: number | bigint,
    [k: `any.${string}`]: number | bigint,
    any: number | bigint,
  } | {
    [k: `any.${string}`]: Date | { $date: number },
    any: Date | { $date: number },
  }>,
  $max?: Partial<{
    num: number | bigint,
    [k: `any.${string}`]: number | bigint,
    any: number | bigint,
  } | {
    [k: `any.${string}`]: Date | { $date: number },
    any: Date | { $date: number },
  }>,
  $mul?: Partial<{
    num: number | bigint,
    [k: `any.${string}`]: number | bigint,
    any: number | bigint,
  }>,
  $addToSet?: Partial<{
    [k: `any.${string}`]: unknown,
    any: unknown,
  }>,
}>>

const test2: StrictUpdateFilter<BasicSchema> = {
  $set: {
    num: 1,
    str: '1',
    any: 1,
    'any.a': 1,
    'obj.str': '1',
    obj: { str: '1' },
  },
  $setOnInsert: {
    num: 1,
    str: '1',
    any: 1,
    'any.a': 1,
    'obj.str': '1',
    obj: { str: '1' },
  },
  $unset: {
    num: '',
    str: '',
    any: '',
    'any.a': '',
    'obj.str': '',
    obj: '',
  },
  $inc: {
    num: 1,
    'any.a': 1,
    any: 1,
  },
  $push: {
    'any.a': 1,
    any: 1,
  },
  $pop: {
    'any.a': 1,
    any: 1,
  },
  $rename: {
    num: '1',
    str: '1',
    any: '1',
    'any.a': '1',
    'obj.str': '1',
    obj: '1',
  },
  $currentDate: {
    any: true,
  },
  $min: {
    num: 1,
    'any.a': 1,
    any: 1,
  },
  $max: {
    num: 1,
    'any.a': 1,
    any: 1,
  },
  $mul: {
    num: 1,
    'any.a': 1,
    any: 1,
  },
  $addToSet: {
    'any.a': 1,
    any: 1,
  },
}

const test3: StrictUpdateFilter<Schema> = {
  $set: {
    // @ts-expect-error - Invalid type
    num1: 'a',
    arr: [
      // @ts-expect-error - Invalid type
      1,
      '1'
    ],
    // @ts-expect-error - Invalid type
    'obj.str2': 2,
    // @ts-expect-error - Invalid type
    obj: {},
    'obj.obj': {
      // @ts-expect-error - Invalid type
      num: '1',
      any: { a: 1 }
    },
  },
  $unset: {
    // @ts-expect-error - Invalid type
    num1: 1,
    // @ts-expect-error - Invalid type
    num2: '1',
    // @ts-expect-error - Invalid type
    'obj.obj.any.xyz': 3,
  },
  $inc: {
    // @ts-expect-error - Invalid type
    num1: [123],
    // @ts-expect-error - Invalid type
    'obj.obj.any.xyz': '2',
  },
  $push: {
    // @ts-expect-error - Invalid type
    arr: [123, '123'],
  },
  $pop: {
    // @ts-expect-error - Invalid type
    arr: '123',
    // @ts-expect-error - Invalid type
    'obj.obj.any.xyz': 123n,
  },
  $rename: {
    // @ts-expect-error - Invalid type
    num1: 1,
    // @ts-expect-error - Invalid type
    'obj.obj.any.xyz': 1,
  },
  $currentDate: {
    // @ts-expect-error - Invalid type
    'obj.obj.any.xyz': new Date(),
  },
}

const test4: StrictUpdateFilter<SomeDoc> = {
  $set: {
    num1: 'a',
    arr: [
      1,
      '1'
    ],
    'obj.str2': 2,
    obj: {},
    'obj.obj': {
      num: '1',
      any: { a: 1 }
    },
  },
  $unset: {
    // @ts-expect-error - Invalid type
    num1: 1,
    // @ts-expect-error - Invalid type
    num2: '1',
    // @ts-expect-error - Invalid type
    'obj.obj.any.xyz': 3,
  },
  $inc: {
    // @ts-expect-error - Invalid type
    num1: [123],
    // @ts-expect-error - Invalid type
    'obj.obj.any.xyz': '2',
  },
  $push: {
    arr: [123, '123'],
  },
  $pop: {
    // @ts-expect-error - Invalid type
    arr: '123',
    // @ts-expect-error - Invalid type
    'obj.obj.any.xyz': 123n,
  },
  $rename: {
    // @ts-expect-error - Invalid type
    num1: 1,
    // @ts-expect-error - Invalid type
    'obj.obj.any.xyz': 1,
  },
  $currentDate: {
    // @ts-expect-error - Invalid type
    'obj.obj.any.xyz': new Date(),
  },
}

const test5: StrictUpdateFilter<Schema> = {
  $set: {
    // @ts-expect-error - Invalid path
    'obj.obj.xyz': '',
  },
  $unset: {
    // @ts-expect-error - Invalid path
    'obj.obj.xyz': '',
  },
  $inc: {
    // @ts-expect-error - Invalid path
    'obj.obj.any': 1,
  },
  $push: {
    // @ts-expect-error - Invalid path
    num1: 1,
  },
  $pop: {
    // @ts-expect-error - Invalid path
    'obj.obj.xyz': 1,
  },
  $rename: {
    // @ts-expect-error - Invalid path
    'obj.obj.xyz': '1',
  },
  $currentDate: {
    // @ts-expect-error - Invalid path
    'obj.obj.any': true,
  },
}

const test6: StrictUpdateFilter<SomeDoc> = {
  $set: {
    'obj.obj.xyz': '',
  },
  $unset: {
    'obj.obj.xyz': '',
  },
  $inc: {
    'obj.obj.any': 1,
  },
  $push: {
    num1: 1,
  },
  $pop: {
    'obj.obj.xyz': 1,
  },
  $rename: {
    'obj.obj.xyz': '1',
  },
  $currentDate: {
    'obj.obj.any': true,
  },
}

const test7: StrictUpdateFilter<ConvolutedSchema1> = {
  $set: {
    numOrBigInt: 1,
    numOrString: 1,
  },
  $setOnInsert: {
    numOrBigInt: 1n,
    numOrString: '',
  },
  $unset: {
    numOrBigInt: '',
    numOrString: '',
  },
  $inc: {
    numOrBigInt: +1,
    numOrString: -1,
  },
  $rename: {
    numOrBigInt: 'new_name',
    numOrString: 'new_name',
  },
}

const test8: StrictUpdateFilter<ConvolutedSchema1> = {
  $set: {
    numOrBigInt: 1,
    numOrString: 1,
  },
  $setOnInsert: {
    numOrBigInt: 1n,
    numOrString: '',
  },
  $unset: {
    numOrBigInt: '',
    numOrString: '',
  },
  $inc: {
    numOrBigInt: +1,
    numOrString: -1,
  },
  $rename: {
    numOrBigInt: 'new_name',
    numOrString: 'new_name',
  },
}

const test9: StrictUpdateFilter<ConvolutedSchema1> = {
  $set: {
    // @ts-expect-error - Invalid type
    numOrBigInt: '',
    // @ts-expect-error - Invalid type
    numOrString: 1n,
  },
  $setOnInsert: {
    // @ts-expect-error - Invalid path
    intOrBigNum: 1n,
  },
  $unset: {
    // @ts-expect-error - Invalid type
    numOrBigInt: 3,
  },
  $inc: {
    // @ts-expect-error - Invalid type
    numOrString: '',
  },
}

const test10: StrictUpdateFilter<SomeDoc> = {
  $set: {
    numOrBigInt: '',
    numOrString: 1n,
  },
  $setOnInsert: {
    intOrBigNum: 1n,
  },
  $unset: {
    // @ts-expect-error - Invalid type
    numOrBigInt: 3,
  },
  $inc: {
    // @ts-expect-error - Invalid type
    numOrString: '',
  },
}

const test11: StrictUpdateFilter<ConvolutedSchema2> = {
  $set: {
    numOrArray: 1,
  },
  $setOnInsert: {
    numOrArray: [''],
  },
  $unset: {
    numOrArray: '',
  },
  $inc: {
    numOrArray: 1,
  },
  $push: {
    numOrArray: { $each: [''], $position: 1 },
  },
  $rename: {
    numOrArray: 'new_name',
  },
  $min: {
    numOrArray: 1,
  },
  $max: {
    numOrArray: 1,
  },
}

const test12: StrictUpdateFilter<ConvolutedSchema2> = {
  $set: {
    numOrArray: [
      // @ts-expect-error - Invalid type
      1
    ],
  },
  $inc: {
    // @ts-expect-error - Invalid type
    numOrArray: [1],
  },
  $push: {
    numOrArray: {
      $each: [
        // @ts-expect-error - Invalid type
        1
      ],
    },
  },
  $min: {
    // @ts-expect-error - Invalid type
    numOrArray: [''],
  },
}

const test13: StrictUpdateFilter<SomeDoc> = {
  $set: {
    numOrArray: [1],
  },
  $inc: {
    // @ts-expect-error - Invalid type
    numOrArray: [1],
  },
  $push: {
    numOrArray: {
      $each: [1],
    },
  },
  $min: {
    // @ts-expect-error - Invalid type
    numOrArray: [''],
  },
}
