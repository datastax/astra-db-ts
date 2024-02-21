/* eslint-disable @typescript-eslint/no-unused-vars */

import { BasicSchema, Equal, Expect, Schema } from '@/tests/typing/prelude';
import { ToDotNotation } from '@/src/collections/operations/dot-notation';
import { AnyDict } from '@/src/collections/collection';

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
  obj: { str1: string, str2: string, obj: { num: number, any: AnyDict } },
  'obj.str1': string,
  'obj.str2': string,
  'obj.obj': { num: number, any: AnyDict },
  'obj.obj.num': number,
  'obj.obj.any': AnyDict,
  [k: `obj.obj.any.${string}`]: any,
  arr: string[],
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
}

// @ts-expect-no-error - Empty object (for better or for worse)
const test4: Partial<ToDotNotation<Schema>> = {}

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
    }
  },
  arr: [
    '1',
    // @ts-expect-error - Invalid type
    2,
  ],
  // @ts-expect-error - Invalid type
  'obj.obj.any': 3,
}

const test6: Partial<ToDotNotation<Schema>> = {
  num1: 1,
  'obj.str1': '1',
  // @ts-expect-error - Invalid path
  'obj.rammstein': 'Angst',
}
