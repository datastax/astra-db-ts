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

import type { ObjectId, SomeDoc, UUID } from '@/src/documents';

/**
 * Converts some `Schema` into a type representing its dot notation (object paths).
 *
 * If a value is any or SomeDoc, it'll be allowed to be any old object.
 *
 * *Note that this does NOT support indexing into arrays beyond the initial array index itself. Meaning,
 * `arr.0` is supported, but `arr.0.property` is not. Use a more flexible type (such as `any` or `SomeDoc`)
 * to support that.*
 *
 * @example
 * ```typescript
 * interface BasicSchema {
 *   num: number,
 *   arr: string[],
 *   obj: {
 *     nested: string,
 *     someDoc: SomeDoc,
 *   }
 * }
 * 
 * interface BasicSchemaInDotNotation {
 *   'num': number,
 *   'arr': string[],
 *   [`arr.${number}`]: string,
 *   'obj': { nested: string, someDoc: SomeDoc }
 *   'obj.nested': string,
 *   'obj.someDoc': SomeDoc,
 *   [`obj.someDoc.${string}`]: any,
 * }
 * ```
 *
 * @public
 */
export type ToDotNotation<Schema extends SomeDoc> = Merge<_ToDotNotation<Schema, ''>>;

type _ToDotNotation<_Elem extends SomeDoc, Prefix extends string, Elem = Required<_Elem>> = {
  [Key in keyof Elem]:
    SomeDoc extends Elem
      ? (
        | (Prefix extends '' ? never : Record<CropTrailingDot<Prefix>, Elem>)
        | Record<`${Prefix}${string}`, any>
        ) :
    true extends false & Elem[Key]
      ? (
        | Record<`${Prefix}${Key & string}`, Elem[Key]>
        | Record<`${Prefix}${Key & string}.${string}`, Elem[Key]>
        ) :
    Elem[Key] extends any[]
      ? (
        | Record<`${Prefix}${Key & string}`, Elem[Key]>
        | Record<`${Prefix}${Key & string}.${number}`, Elem[Key][number]>
        ) :
    Elem[Key] extends UUID | ObjectId
      ? Record<`${Prefix}${Key & string}`, Elem[Key]> :
    Elem[Key] extends Date
      ? Record<`${Prefix}${Key & string}`, Date | { $date: number }> :
    Elem[Key] extends SomeDoc
      ? (
        | Record<`${Prefix}${Key & string}`, Elem[Key]>
        | _ToDotNotation<Elem[Key], `${Prefix}${Key & string}.`>
        )
      : Record<`${Prefix}${Key & string}`, Elem[Key]>
}[keyof Elem] extends infer Value
  ? Value
  : never;

type CropTrailingDot<Str extends string> =
  Str extends `${infer T}.`
    ? T
    : Str;

type Merge<Ts> = Expand<UnionToIntersection<Ts>>;

type UnionToIntersection<U> = (U extends any ? (arg: U) => any : never) extends ((arg: infer I) => void) ? I : never;

type Expand<T> = T extends infer O
  ? { [K in keyof O]: O[K] }
  : never;
