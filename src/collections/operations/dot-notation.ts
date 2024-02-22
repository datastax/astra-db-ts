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

import { SomeDoc } from '@/src/collections/collection';

export type ToDotNotation<Schema extends SomeDoc> = Merge<_ToDotNotation<Required<Schema>, ''>>

type _ToDotNotation<Elem extends SomeDoc, Prefix extends string> = {
  [Key in keyof Elem]:
    SomeDoc extends Elem
      ? (
        | (Prefix extends '' ? never : { [Path in CropTrailingDot<Prefix>]: Elem })
        | { [Path in `${Prefix}${string}`]: any }
        ) :
    Elem[Key] extends any[]
      ? { [Path in `${Prefix}${Key & string}`]: Elem[Key] } :
    Elem[Key] extends Date
      ? { [Path in `${Prefix}${Key & string}`]: Date | { $date: number } } :
    Elem[Key] extends SomeDoc
      ? (
        | { [Path in `${Prefix}${Key & string}`]: Elem[Key] }
        | _ToDotNotation<Elem[Key], `${Prefix}${Key & string}.`>
        )
      : { [Path in `${Prefix}${Key & string}`]: Elem[Key] }
}[keyof Elem] extends infer Value
  ? Value
  : never

type CropTrailingDot<Str extends string> =
  Str extends `${infer T}.`
    ? T
    : Str;

type Merge<Ts> = Expand<UnionToIntersection<Ts>>

type UnionToIntersection<U> = (U extends any ? (arg: U) => any : never) extends ((arg: infer I) => void) ? I : never

type Expand<T> = T extends infer O
  ? { [K in keyof O]: O[K] }
  : never
