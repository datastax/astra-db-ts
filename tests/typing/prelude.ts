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

import { SomeDoc } from '@/src/client';

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
export type Expect<T extends true> = T;

export interface SuperBasicSchema {
  num: number,
  obj: {
    str: string,
  },
}

export interface BasicSchema {
  num: number,
  str: string,
  any: any,
  obj: {
    str: string,
  },
}

export interface Schema {
  num1: number,
  num2: number,
  obj: {
    str1: string,
    str2: string,
    obj: {
      num: number,
      any: SomeDoc,
    },
  },
  arr: string[],
}

export interface ConvolutedSchema1 {
  numOrBigInt: number | bigint,
  numOrString: number | string,
}

export interface ConvolutedSchema2 {
  numOrArray: number | string[],
}
