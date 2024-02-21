/* eslint-disable @typescript-eslint/no-unused-vars */

import { UpdateFilter } from '@/src/collections';
import { BasicSchema, Equal, Expect, Schema } from '@/tests/typing/prelude';

type test1 = Expect<Equal<UpdateFilter<BasicSchema>, {
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
    num: number,
    [k: `any.${string}`]: number,
    any: number,
  }>,
  $push?: Partial<{
    [k: `any.${string}`]: unknown,
    any: unknown,
  }>,
  $pop?:  Partial<{
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
    num: number,
    [k: `any.${string}`]: number,
    any: number,
  }>,
  $max?: Partial<{
    num: number,
    [k: `any.${string}`]: number,
    any: number,
  }>,
  $mul?: Partial<{
    num: number,
    [k: `any.${string}`]: number,
    any: number,
  }>,
  $addToSet?: Partial<{
    [k: `any.${string}`]: unknown,
    any: unknown,
  }>,
}>>

const test2: UpdateFilter<Schema> = {
  $set: {
    num1: 3,
    'obj.obj.any': {
      num: 3,
    },
    'obj.obj.any.gma.t.50': 3,
  },
  $setOnInsert: {
    num1: 3,
  },
  $unset: {
    num2: '',
  },
  $inc: {
    num1: 3,
  },
  $push: {
    arr: 'hi',
  },
  $pop: {
    arr: 1,
  },
  $rename: {
    arr: 'arr2',
  },
  $min: {
    'obj.obj.num': 3,
  },
  $max: {
    'obj.obj.any.cars2': 3,
  },
  $mul: {
    num1: 3,
  },
  $addToSet: {
    arr: 'hi',
  },
}
