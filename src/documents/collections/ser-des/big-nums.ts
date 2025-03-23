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
import { isBigNumber } from '@/src/lib/utils.js';
import type { ParsedSerDesConfig } from '@/src/lib/api/ser-des/cfg-handler.js';
import type { CollectionSerDesConfig } from '@/src/documents/index.js';
import { pathMatches } from '@/src/lib/api/ser-des/utils.js';
import type { PathSegment } from '@/src/lib/types.js';

/**
 * @public
 */
export type CollNumCoercion =
  | 'number'
  | 'strict_number'
  | 'bigint'
  | 'bignumber'
  | 'string'
  | 'number_or_string'
  | ((val: number | BigNumber, path: readonly PathSegment[]) => unknown);

/**
 * @public
 */
export type GetCollNumCoercionFn = (path: readonly PathSegment[], matches: (path: readonly PathSegment[]) => boolean) => CollNumCoercion;

/**
 * @public
 */
export interface CollNumCoercionCfg {
  '*': CollNumCoercion,
  [path: string]: CollNumCoercion,
}

const $NumCoercion = Symbol('NumCoercion');

interface NumCoercionTree {
  [$NumCoercion]?: CollNumCoercion;
  [key: string]: NumCoercionTree;
}

/**
 * @internal
 */
export const buildGetNumCoercionForPathFn = (cfg: ParsedSerDesConfig<CollectionSerDesConfig>): GetCollNumCoercionFn | undefined => {
  return (typeof cfg?.enableBigNumbers === 'object')
    ? collNumCoercionFnFromCfg(cfg.enableBigNumbers)
    : cfg?.enableBigNumbers;
};

const collNumCoercionFnFromCfg = (cfg: CollNumCoercionCfg): GetCollNumCoercionFn => {
  const defaultCoercion = cfg['*'];

  if (!defaultCoercion) {
    throw new Error('The configuration must contain a "*" key');
  }

  // Minor optimization to make `{ '*': 'xyz' }` equal in performance to `() => 'xyz'`
  if (Object.keys(cfg).length === 1) {
    return () => defaultCoercion;
  }

  const tree = buildNumCoercionTree(cfg);

  return (path) => {
    return findMatchingPath(path, tree) ?? defaultCoercion;
  };
};

const buildNumCoercionTree = (cfg: CollNumCoercionCfg): NumCoercionTree => {
  const result: NumCoercionTree = Object.create(null);

  Object.entries(cfg).forEach(([path, coercion]) => {
    const keys = path.split('.');
    let current = result;

    keys.forEach((key, index) => {
      current[key] ??= Object.create(null);

      if (index === keys.length - 1) {
        current[key][$NumCoercion] = coercion;
      }

      current = current[key];
    });
  });

  return result;
};

const findMatchingPath = (path: readonly PathSegment[], tree: NumCoercionTree): CollNumCoercion | undefined => {
  let coercion: CollNumCoercion | undefined = undefined;

  for (let i = 0; tree && i <= path.length; i++) {
    if (i === path.length) {
      return tree[$NumCoercion];
    }

    const exactMatch = tree[path[i]];

    if (exactMatch) {
      tree = exactMatch;
    } else {
      tree = tree['*'];
      coercion = tree?.[$NumCoercion] ?? coercion;
    }
  }

  return coercion;
};

/**
 * @public
 */
export class NumCoercionError extends Error {
  public readonly path: readonly PathSegment[];
  public readonly value: number | BigNumber;
  public readonly from: 'number' | 'bignumber';
  public readonly to: CollNumCoercion;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  public constructor(path: readonly PathSegment[], value: number | BigNumber, from: 'number' | 'bignumber', to: CollNumCoercion) {
    super(`Failed to coerce value from ${from} to ${to} at path: ${path.join('.')}`);
    this.path = path;
    this.value = value;
    this.from = from;
    this.to = to;
  }
}

/**
 * @internal
 */
export const coerceBigNumber = (value: BigNumber, path: readonly PathSegment[], getNumCoercionForPath: GetCollNumCoercionFn, pathMatches: (path: readonly PathSegment[]) => boolean): unknown => {
  const coercer = getNumCoercionForPath(path, pathMatches);

  if (typeof coercer === 'function') {
    return coercer(value, path);
  }

  switch (coercer) {
    case 'number': {
      return value.toNumber();
    }
    case 'strict_number': {
      const asNum = value.toNumber();

      if (!value.isEqualTo(asNum)) {
        throw new NumCoercionError(path, value, 'bignumber', 'number');
      }

      return asNum;
    }
    case 'bigint': {
      if (!value.isInteger()) {
        throw new NumCoercionError(path, value, 'bignumber', 'bigint');
      }
      return BigInt(value.toFixed(0));
    }
    case 'bignumber':
      return value;
    case 'string':
      return value.toString();
    case 'number_or_string': {
      const asNum = value.toNumber();

      if (!value.isEqualTo(asNum)) {
        return value.toString();
      }

      return asNum;
    }
  }
};

/**
 * @internal
 */
export const coerceNumber = (value: number, path: readonly PathSegment[], getNumCoercionForPath: GetCollNumCoercionFn, pathMatches: (path: readonly PathSegment[]) => boolean): unknown => {
  const coercer = getNumCoercionForPath(path, pathMatches);

  if (typeof coercer === 'function') {
    return coercer(value, path);
  }

  switch (coercer) {
    case 'bigint': {
      if (!Number.isInteger(value)) {
        throw new NumCoercionError(path, value, 'number', 'bigint');
      }
      return BigInt(value);
    }
    case 'bignumber':
      return BigNumber(value);
    case 'string':
      return String(value);
    case 'number':
    case 'strict_number':
    case 'number_or_string':
      return value;
  }
};

/**
 * @internal
 */
export const coerceNums = (val: unknown, getNumCoercionForPath: GetCollNumCoercionFn) => {
  return coerceNumsImpl(val, [], getNumCoercionForPath, (p) => pathMatches([], p));
};

/**
 * @internal
 */
const coerceNumsImpl = (val: unknown, path: PathSegment[], getNumCoercionForPath: GetCollNumCoercionFn, pathMatchesFn: (path: readonly PathSegment[]) => boolean): unknown => {
  if (typeof val === 'number') {
    return coerceNumber(val, path, getNumCoercionForPath, pathMatchesFn);
  }

  if (!val || typeof val !== 'object') {
    return val;
  }

  if (isBigNumber(val)) {
    return coerceBigNumber(val, path, getNumCoercionForPath, pathMatchesFn);
  }

  path.push('<temp>');

  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i++) {
      path[path.length - 1] = i;
      val[i] = coerceNumsImpl(val[i], path, getNumCoercionForPath, (p) => pathMatches(path, p));
    }
  } else {
    for (const key of Object.keys(val)) {
      path[path.length - 1] = key;
      (val as any)[key] = coerceNumsImpl((val as any)[key], path, getNumCoercionForPath, (p) => pathMatches(path, p));
    }
  }

  path.pop();
  return val;
};
