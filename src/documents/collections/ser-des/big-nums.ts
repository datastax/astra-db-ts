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
import { isBigNumber, pathMatches } from '@/src/lib/utils.js';
import { AstraDbCloudProvider } from '@/src/administration/index.js';

/**
 * @public
 */
export type CollNumRep =
  | 'number'
  | 'bigint'
  | 'bignumber'
  | 'string'
  | 'number_or_string';

/**
 * @public
 */
export type GetCollNumRepFn = (path: readonly (string | number)[], matches: (exp: readonly (string | number)[], acc: readonly (string | number)[]) => boolean) => CollNumRep;

/**
 * @public
 */
export type CollNumRepCfg = Record<string, CollNumRep>;

const $NumRep = Symbol('NumRep');

interface NumRepTree {
  [$NumRep]?: CollNumRep;
  [key: string]: NumRepTree;
}

export const collNumRepFnFromCfg = (cfg: CollNumRepCfg): GetCollNumRepFn => {
  // Minor optimization to make `{ '*': 'xyz' }` equal in performance to `() => 'xyz'`
  if (Object.keys(cfg).length === 1 && cfg['*']) {
    const rep = cfg['*'];
    return () => rep;
  }

  const tree = buildNumRepTree(cfg);

  return (path) => {
    return findMatchingPath(path, tree) ?? 'number';
  };
};

const buildNumRepTree = (cfg: CollNumRepCfg): NumRepTree => {
  const result: NumRepTree = {};

  Object.entries(cfg).forEach(([path, rep]) => {
    const keys = path.split('.');
    let current = result;

    keys.forEach((key, index) => {
      current[key] ??= {};

      if (index === keys.length - 1) {
        current[key][$NumRep] = rep;
      }

      current = current[key];
    });
  });

  return result;
};

const findMatchingPath = (path: readonly (string | number)[], tree: NumRepTree | undefined): CollNumRep | undefined => {
  let rep: CollNumRep | undefined = undefined;

  for (let i = 0; tree && i <= path.length; i++) {
    if (i === path.length) {
      return tree[$NumRep];
    }

    const exactMatch = tree[path[i]];

    if (exactMatch) {
      tree = exactMatch;
    } else {
      tree = tree['*'];
      rep = tree?.[$NumRep] ?? rep;
    }
  }

  return rep;
};

/**
 * @public
 */
export class NumCoercionError extends Error {
  public readonly path: (string | number)[];
  public readonly value: number | BigNumber;
  public readonly from: 'number' | 'bignumber';
  public readonly to: CollNumRep;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  public constructor(path: (string | number)[], value: number | BigNumber, from: 'number' | 'bignumber', to: CollNumRep) {
    super(`Failed to coerce value from ${from} to ${to} at path: ${path.join('.')}`);
    this.path = path;
    this.value = value;
    this.from = from;
    this.to = to;
  }
}

export const coerceBigNumber = (value: BigNumber, path: (string | number)[], getNumRepForPath: GetCollNumRepFn): unknown => {
  switch (getNumRepForPath(path, pathMatches)) {
    case 'number': {
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
    case 'number_or_string':
      return value.toString();
  }
};

export const coerceNumber = (value: number, path: (string | number)[], getNumRepForPath: GetCollNumRepFn): unknown => {
  switch (getNumRepForPath(path, pathMatches)) {
    case 'bigint': {
      if (!Number.isInteger(value)) {
        throw new NumCoercionError(path, value, 'number', 'bigint');
      }
      return BigInt(value);
    }
    case 'bignumber':
      return BigNumber(value);
    case 'string':
      return value.toString();
    case 'number':
    case 'number_or_string':
      return value;
  }
};

export const coerceNums = (val: unknown, path: (string | number)[], getNumRepForPath: GetCollNumRepFn): unknown => {
  if (typeof val === 'number') {
    return coerceNumber(val, path, getNumRepForPath);
  }

  if (!val || typeof val !== 'object') {
    return val;
  }

  if (isBigNumber(val)) {
    return coerceBigNumber(val, path, getNumRepForPath);
  }

  path.push('<temp>');

  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i++) {
      path[path.length - 1] = i;
      val[i] = coerceNums(val[i], path, getNumRepForPath);
    }
  } else {
    for (const key of Object.keys(val)) {
      path[path.length - 1] = key;
      (val as any)[key] = coerceNums((val as any)[key], path, getNumRepForPath);
    }
  }

  path.pop();
  return val;
};
