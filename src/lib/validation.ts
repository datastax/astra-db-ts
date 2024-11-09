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

import { isNullish } from '@/src/lib/utils';

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
export const EqualityProof = <X, Y, _ extends Equal<X, Y>>() => {};

export type Parser<A, R = A> = (input: R, field: string) => A;

export const isNonEmpty = <A>(xs: A[]): xs is [A, ...A[]] => {
  return xs.length !== 0;
};

type TypeOfAble = `${'string' | 'number' | 'boolean' | 'object' | 'function'}${'!' | '?'}`;

type TypeOf<Str extends string> = (Str extends `${infer T}${'!' | '?'}` ? LitTypeOf<T> : never)

type LitTypeOf<T extends string> =
  T extends 'string'
    ? string :
  T extends 'object'
    ? Record<string, unknown> :
  T extends 'number'
    ? number :
  T extends 'boolean'
    ? boolean :
  T extends 'function'
    ? (...args: any[]) => any
    : never;

type ParseRes<T extends string, X> = T extends `${string}?` ? X | undefined : X;

export const p = {
  includes<X>(xs: readonly X[], x: unknown): x is X {
    return (xs as readonly X[]).includes(x as X);
  },
  mkStrEnumParser: <X, const R extends boolean>(name: string, xs: readonly X[], required: R) => (x: unknown, field: string): X | (R extends false ? undefined : never) => {
    if ((required && isNullish(x)) || (typeof x !== 'string' && !isNullish(x))) {
      throw new TypeError(`Expected ${field} to be of string enum ${name}, but got ${typeof x}`);
    }
    if (!isNullish(x) && !p.includes(xs, x)) {
      throw new TypeError(`Expected ${field} to be of string enum ${name}${required ? '' : '(or null/undefined)'} (one of ${xs.join(', ')}), but got '${x}'`);
    }
    return x ?? undefined!;
  },
  parse: <U extends TypeOfAble, X = TypeOf<U>>(expected: U, parser: Parser<X, TypeOf<U>> = x => x) => <Cast = ParseRes<U, X>>(x: unknown, field: string): Cast => {
    if (expected.at(-1) === '!' && isNullish(x)) {
      throw new TypeError(`Expected ${field} to be of type ${expected} (non-null), but got null or undefined`);
    } else if (isNullish(x)) {
      return undefined!;
    }

    if (typeof x !== expected.slice(0, -1)) {
      throw new TypeError(`Expected ${field} to be of type ${expected} (or nullish), but got ${typeof x}`);
    }

    return parser(x as any, field) as any;
  },
};
