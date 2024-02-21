import { AnyDict } from '@/src/collections/collection';

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
export type Expect<T extends true> = T;

export interface BasicSchema {
  num: number,
  str: string,
  any: any,
  obj: {
    str: string,
  }
}

export interface Schema {
  num1: number,
  num2: number,
  obj: {
    str1: string,
    str2: string,
    obj: {
      num: number,
      any: AnyDict,
    },
  },
  arr: string[],
}
