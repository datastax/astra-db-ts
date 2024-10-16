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

export type Parser<A, R = unknown> = (input: R, field: string) => Result<A>;

export const isNonEmpty = <A>(xs: A[]): xs is [A, ...A[]] => {
  return xs.length !== 0;
};

interface ResultFns<A> {
  [Symbol.iterator]: () => Iterator<Result<A>, A>,
  unwrap(onFail?: (e: Error) => A): A,
  isOk(): this is ResultFns<A> & { $tag: 'r', $value: A },
}

export type Result<A> = ResultFns<A> & ({ $tag: 'l', $value: Error } | { $tag: 'r', $value: A });

export const fail = <A>(l: Error): Result<A> => ({
  $tag: 'l',
  $value: l,
  isOk(): this is ResultFns<A> & { $tag: 'r', $value: A } {
    return false;
  },
  [Symbol.iterator]: function*() {
    return (yield this);
  },
  unwrap(onFail = ((e) => { throw e; })): A {
    return onFail(this.$value);
  },
});

export const ok = <A>(r: A): Result<A> => ({
  $tag: 'r',
  $value: r,
  isOk(): this is ResultFns<A> & { $tag: 'r', $value: A } {
    return true;
  },
  [Symbol.iterator]: function*() {
    return (yield this);
  },
  unwrap(): A {
    return this.$value;
  },
});

export const r = {
  mapM: <A, B>(f: (r: A, i: number) => Result<B>) => (r1s: Iterable<A>): Result<B[]> => {
    const eithers: B[] = [];
    let i = 0;

    for (const r1 of r1s) {
      const either = f(r1, i++);
      if (!either.isOk()) {
        return r.coerceR(either);
      }
      eithers.push(either.$value);
    }

    return ok(eithers);
  },
  coerceR<A, B>(e: Result<A> & { $tag: 'l' }): Result<B> {
    return e as unknown as Result<B>;
  },
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

type MaybeNullish<T extends string, X> = T extends `${string}?` ? X | undefined : X;

export const p = {
  error<R>(e: string): Result<R> {
    return fail(new Error(e));
  },
  typeError<R>(e: string): Result<R> {
    return fail(new TypeError(e));
  },
  includes<X>(xs: readonly X[], x: unknown): x is X {
    return (xs as readonly X[]).includes(x as X);
  },
  mkStrEnumParser: <X, const R extends boolean>(name: string, xs: readonly X[], required: R) => (x: unknown, field: string): Result<X | (R extends false ? undefined : never)> => {
    if (required !== false && isNullish(x)) {
      return p.typeError(`Expected ${field} to be of string enum ${name}, but got ${x}`);
    }
    if (!isNullish(x) && !p.includes(xs, x)) {
      return p.typeError(`Expected ${field} to be of string enum ${name} (or null/undefined) (one of ${xs.join(', ')}), but got ${x}`);
    }
    return ok(x ?? undefined!);
  },
  parse: <U extends TypeOfAble, X = TypeOf<U>>(expected: U, parser: Parser<X, TypeOf<U>> = ok) => (x: unknown, field: string): Result<MaybeNullish<U, X>> => {
    if (expected.at(-1) === '!' && isNullish(x)) {
      return p.typeError('');
    } else if (isNullish(x)) {
      return ok(undefined!);
    }

    if (typeof x !== expected.slice(0, -1)) {
      return p.typeError('');
    }

    return parser(expected as any, field);
  },
  do: <A, R = unknown>(fun: (raw: R, field: string) => Generator<Result<unknown>, A, void>): Parser<A, R> => (raw, field) => {
    const iterator = fun(raw, field);
    const state = iterator.next();

    function run(state: any): any {
      if (state.done) {
        return ok(state.value);
      }
      return state.value.chain((val: any) => {
        return run(iterator.next(val));
      });
    }

    return run(state);
  },
};
