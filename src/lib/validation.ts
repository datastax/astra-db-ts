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

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
export type Expect<T extends true> = T;

export type NonEmpty<A> = [A, ...A[]];

export const isNonEmpty = <A>(xs: A[]): xs is NonEmpty<A> => {
  return xs.length !== 0;
};

export type Either<L, R> = [L] | [never, R];
export type Validation<V> = Either<Error, V>;

export const left  = <L, R>(l: L): Either<L, R> => [l];
export const right = <L, R>(r: R): Either<L, R> => [null as never, r];

export const isLeft  = <L, R>(e: Either<L, R>): e is [L] => e.length === 1;
export const isRight = <L, R>(e: Either<L, R>): e is [never, R] => e.length === 2;

export const bindEither = <L, R, T>(e: Either<L, R>, f: (r: R) => Either<L, T>): Either<L, T> => {
  if (isLeft(e)) {
    return e;
  }
  return f(e[1]);
};

export const mapMEither = <L, R1, R2>(f: (r: R1, i: number) => Either<L, R2>) => (r1s: R1[]): Either<L, R2[]> => {
  const es: R2[] = [];

  for (let i = 0, n = r1s.length; i < n; i++) {
    const e = f(r1s[i], i);
    if (isLeft(e)) {
      return e;
    }
    es.push(e[1]);
  }

  return right(es);
};

export const error = <R>(e: string): Validation<R> => [new Error(e)];
export const typeError = <R>(e: string): Validation<R> => [new TypeError(e)];

export const includes = <X>(xs: readonly X[], x: unknown): x is X => (xs as readonly X[]).includes(x as X);

export const validateInStrEnum = <X>(name: string, xs: readonly X[]) => (x: string, field: string): Validation<X> => {
  if (!includes(xs, x)) {
    return typeError(`Expected string @ ${field} to be of string enum ${name}`);
  }
  return right(x);
};
