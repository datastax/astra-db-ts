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

import type JBI from 'json-bigint';
import type { SomeDoc } from '@/src/documents/index.js';
import { BigNumber } from 'bignumber.js';
import type { Decoder} from 'decoders';
import { array, define, either, instanceOf } from 'decoders';

/**
 * @internal
 */
export function isNullish(t: unknown): t is null | undefined {
  return t === null || t === undefined;
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
export function withJbiNullProtoFix(jbi: ReturnType<typeof JBI>) {
  return {
    parse: (str: string) => nullProtoFix(jbi.parse(str)),
    stringify: jbi.stringify,
  };
}

function nullProtoFix(doc: SomeDoc): SomeDoc {
  if (!doc || typeof doc !== 'object') {
    return doc;
  }

  if (isBigNumber(doc)) {
    return BigNumber(doc);
  }

  if (Array.isArray(doc)) {
    for (let i = 0; i < doc.length; i++) {
      doc[i] = nullProtoFix(doc[i]);
    }
  } else {
    Object.setPrototypeOf(doc, Object.prototype);

    for (const key of Object.keys(doc)) {
      doc[key] = nullProtoFix(doc[key]);
    }
  }

  return doc;
}

/**
 * @internal
 */
export function pathArraysEqual(a: readonly (string | number)[], b: readonly (string | number)[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

/**
 * @internal
 */
export function pathMatches(exp: readonly (string | number)[], acc: readonly (string | number)[]): boolean {
  if (exp.length !== acc.length) {
    return false;
  }

  for (let i = 0; i < acc.length; i++) {
    if (exp[i] !== '*' && exp[i] !== acc[i]) {
      return false;
    }
  }

  return true;
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
  return BigNumber.isBigNumber(value) && value.constructor?.name === 'BigNumber';
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
 * @internal
 */
export const numDigits = (n: number) => {
  return (n !== 0) ? Math.floor(Math.log10(Math.abs(n))) + 1 : 1;
};

export function findLast<T>(predicate: (value: T, index: number) => boolean): (arr: readonly T[]) => T | undefined
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
