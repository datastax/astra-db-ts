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

import type {
  BasicSchema,
  ConvolutedSchema1,
  ConvolutedSchema3,
  Equal,
  Expect,
  Schema,
} from '@/tests/typing/prelude.js';
import type { SomeDoc, ToDotNotation } from '@/src/documents/index.js';
import { UUID } from '@/src/documents/index.js';

type test1 = Expect<Equal<ToDotNotation<BasicSchema>, {
  num: number,
  str: string,
  any: any,
  [k: `any.${string}`]: any,
  obj: { str: string },
  'obj.str': string,
}>>

type test2 = Expect<Equal<ToDotNotation<Schema>, {
  num1: number,
  num2: number,
  obj: { str1: string, str2: string, obj: { num: number, any: SomeDoc } },
  'obj.str1': string,
  'obj.str2': string,
  'obj.obj': { num: number, any: SomeDoc },
  'obj.obj.num': number,
  'obj.obj.any': SomeDoc & Required<SomeDoc>,
  [k: `obj.obj.any.${string}`]: any,
  arr: string[],
  [k: `arr.${number}`]: string,
}>>

// @ts-expect-no-error - Valid properties & types
const test3: Partial<ToDotNotation<Schema>> = {
  num1: 1,
  num2: 2,
  obj: { str1: '1', str2: '2', obj: { num: 3, any: { a: 1 } } },
  'obj.str1': '1',
  'obj.str2': '2',
  'obj.obj': { num: 3, any: { a: 1 } },
  'obj.obj.num': 3,
  'obj.obj.any': { a: 1 },
  'obj.obj.any.some-random-property': 1,
  'obj.obj.any.some-other-property': '1',
  arr: ['1', '2'],
};

// @ts-expect-no-error - Empty object (for better or for worse)
const test4: Partial<ToDotNotation<Schema>> = {};

const test5: Partial<ToDotNotation<Schema>> = {
  // @ts-expect-error - Invalid type
  num1: '1',
  obj: {
    // @ts-expect-error - Invalid type
    str1: 1,
    str2: '2',
    obj: {
      num: 3,
      // @ts-expect-error - Invalid type
      any: 'any',
    },
  },
  arr: [
    '1',
    // @ts-expect-error - Invalid type
    2,
  ],
  // @ts-expect-error - Invalid type
  'obj.obj.any': 3,
};

const test6: Partial<ToDotNotation<Schema>> = {
  num1: 1,
  'obj.str1': '1',
  // @ts-expect-error - Invalid path
  'obj.rammstein': 'Angst',
};

const test7: Partial<ToDotNotation<ConvolutedSchema1>> = {
  numOrBigInt: 1n,
  numOrString: '',
};

const test8: Partial<ToDotNotation<ConvolutedSchema1>> = {
  numOrBigInt: 1,
  numOrString: 1,
};

const test9: Partial<ToDotNotation<ConvolutedSchema1>> = {
  // @ts-expect-error - Invalid type
  numOrBigInt: '',
  // @ts-expect-error - Invalid type
  numOrString: 1n,
};

const test10: Partial<ToDotNotation<ConvolutedSchema3>> = {
  'obj.id': UUID.v7(),
};
