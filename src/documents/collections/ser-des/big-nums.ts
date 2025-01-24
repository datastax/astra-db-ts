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

import BigNumber from 'bignumber.js';
import { CollDesCtx } from '@/src/documents';

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
export type GetCollNumRepFn = (path: readonly string[]) => CollNumRep;

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
  const tree = buildNumRepTree(cfg);

  return (path: readonly string[]) => {
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

const findMatchingPath = (path: readonly string[], tree: NumRepTree | undefined): CollNumRep | undefined => {
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
  public readonly path: string[];
  public readonly value: number | BigNumber;
  public readonly from: 'number' | 'bignumber';
  public readonly to: CollNumRep;

  /**
   * Should not be instantiated by the user.
   *
   * @internal
   */
  public constructor(path: string[], value: number | BigNumber, from: 'number' | 'bignumber', to: CollNumRep) {
    super(`Failed to coerce value from ${from} to ${to} at path: ${path.join('.')}`);
    this.path = path;
    this.value = value;
    this.from = from;
    this.to = to;
  }
}

export const coerceBigNumber = (value: BigNumber, ctx: CollDesCtx): readonly [0 | 1 | 2, unknown?] => {
  switch (ctx.getNumRepForPath!(ctx.path)) {
    case 'number': {
      const asNum = value.toNumber();

      if (!value.isEqualTo(asNum)) {
        throw new NumCoercionError(ctx.path, value, 'bignumber', 'number');
      }

      return ctx.continue(asNum);
    }
    case 'bigint': {
      if (!value.isInteger()) {
        throw new NumCoercionError(ctx.path, value, 'bignumber', 'bigint');
      }
      return ctx.continue(BigInt(value.toFixed(0)));
    }
    case 'bignumber':
      return ctx.continue(value);
    case 'string':
    case 'number_or_string':
      return ctx.continue(value.toString());
  }
};

export const coerceNumber = (value: number, ctx: CollDesCtx): readonly [0 | 1 | 2, unknown?] => {
  switch (ctx.getNumRepForPath!(ctx.path)) {
    case 'bigint': {
      if (!Number.isInteger(value)) {
        throw new NumCoercionError(ctx.path, value, 'number', 'bigint');
      }
      return ctx.continue(BigInt(value));
    }
    case 'bignumber':
      return ctx.continue(BigNumber(value));
    case 'string':
      return ctx.continue(value.toString());
    case 'number':
    case 'number_or_string':
      return ctx.continue(value);
  }
};
