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

import { BigNumber } from 'bignumber.js';
import type { Decoder } from 'decoders';
import { array, define, either, instanceOf } from 'decoders';
import type { EmptyObj, nullish } from '@/src/lib/types.js';

/**
 * @internal
 */
export function isNullish(t: unknown): t is null | undefined {
  return t === null || t === undefined;
}

/**
 * @internal
 */
export function jsonTryStringify(value: unknown, otherwise: string): string {
  try {
    return JSON.stringify(value);
  } catch (_) {
    return otherwise;
  }
}

/**
 * @internal
 */
export function jsonTryParse<T>(json: string, otherwise: T, reviver?: (this: unknown, key: string, value: unknown) => unknown): T {
  try {
    return JSON.parse(json, reviver);
  } catch (_) {
    return otherwise;
  }
}

/**
 * @internal
 */
export function buildAstraEndpoint(id: string, region: string, env: 'dev' | 'test' | 'prod' = 'prod') {
  return 'https://' + id + '-' + region + `.apps${env === 'prod' ? '' : `-${env}`}.astra.datastax.com`;
}

/**
 * @internal
 */
export function toArray<T>(t: T | readonly T[]): readonly T[] {
  return Array.isArray(t) ? t : [t] as readonly [T];
}

/**
 * @internal
 */
interface JSEnvs<F> {
  server: F,
  browser: F,
  unknown: F,
}

const getJSEnv = () =>
  (typeof globalThis.window !== 'undefined')
    ? 'browser' :
  (typeof globalThis.Buffer !== 'undefined')
    ? 'server'
    : 'unknown';

const env = getJSEnv();

/**
 * @internal
 */
export const forJSEnv = (typeof process !== 'undefined' && typeof process.env === 'object' && process.env.CLIENT_DYNAMIC_JS_ENV_CHECK)
  /* Version of forJSEnv which re-checks the env @ every call for testing purposes (allows for "mocking" different js envs) */
  ? <Args extends any[], R>(fns: JSEnvs<(...args: Args) => R>): (...args: Args) => R => (...args: Args) => fns[getJSEnv()](...args)
  /* istanbul ignore else: same logic as above */
  : <Args extends any[], R>(fns: JSEnvs<(...args: Args) => R>): (...args: Args) => R => fns[env];

/**
 * @internal
 */
export function isBigNumber(value: object): value is BigNumber {
  return BigNumber.isBigNumber(value) && 's' in value && 'e' in value && 'c' in value;
}

/**
 * @internal
 */
export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

/**
 * @internal
 */
export const EqualityProof = <X, Y, _ extends Equal<X, Y>>() => {};

/**
 * @internal
 */
export const oneOrMany = <T>(decoder: Decoder<T>): Decoder<T | T[]> => {
  return either(decoder, array(decoder));
};

/**
 * @internal
 */
export const function_ = define<(...any: any[]) => any>((fn, ok, err) => {
  if (typeof fn === 'function') {
    return ok(fn as any);
  } else {
    return err('Input must be a function');
  }
});

/**
 * @internal
 */
export const anyInstanceOf = <T>(cls: abstract new (...args: any[]) => T) => instanceOf(cls as any) as Decoder<T>;

/**
 * **IMPORTANT: Should only handle finite integers**
 *
 * @internal
 */
export const numDigits = (n: number) => {
  return (n !== 0) ? Math.floor(Math.log10(Math.abs(n))) + 1 : 1;
};

/**
 * @internal
 */
export function findLast<T>(predicate: (value: T, index: number) => boolean): (arr: readonly T[]) => T | undefined

/**
 * @internal
 */
export function findLast<T>(predicate: (value: T, index: number) => boolean, orElse: T): (arr: readonly T[]) => T

export function findLast<T>(predicate: (value: T, index: number) => boolean, orElse?: T) {
  return (arr: readonly T[]): T | undefined => {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (predicate(arr[i], i)) {
        return arr[i];
      }
    }
    return orElse;
  };
}

/**
 * @internal
 */
const enum QueryStateState {
  Unattempted,
  Found,
  NotFound,
}

/**
 * @internal
 */
export class QueryState<T extends EmptyObj> {
  private _state = QueryStateState.Unattempted;
  private _value: T | null = null;

  public isUnattempted(): this is { get unwrap(): null } {
    return this._state === QueryStateState.Unattempted;
  }

  public isFound(): this is { get unwrap(): T } {
    return this._state === QueryStateState.Found;
  }

  public isNotFound(): this is { get unwrap(): null } {
    return this._state === QueryStateState.NotFound;
  }

  public swap(value: T | nullish) {
    if (isNullish(value)) {
      this._state = QueryStateState.NotFound;
    } else {
      this._state = QueryStateState.Found;
      this._value = value;
    }
    return this;
  }

  public get unwrap() {
    return this._value;
  }
}
