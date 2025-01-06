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

export type CollNumRep =
  | 'number'
  | 'bigint'
  | 'bignumber'
  | 'string'
  | 'number_or_string';

export type GetCollNumRepFn = (path: string[]) => CollNumRep;

export type CollNumRepCfg = Record<string, CollNumRep>;

const $NumRep = Symbol('NumRep');

interface NumRepTree {
  [$NumRep]?: CollNumRep;
  [key: string]: NumRepTree;
}

export const collNumRepFnFromCfg = (cfg: CollNumRepCfg): GetCollNumRepFn => {
  const tree = buildNumRepTree(cfg);

  return (path: string[]) => {
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

const findMatchingPath = (path: string[], tree: NumRepTree | undefined): CollNumRep | undefined => {
  if (!tree) {
    return undefined;
  }

  if (path.length === 0) {
    return tree[$NumRep];
  }

  const [key, ...rest] = path;

  return findMatchingPath(rest, tree[key]) ?? findMatchingPath(rest, tree['*']) ?? tree['*']?.[$NumRep];
};

export class NumCoercionError extends Error {
  public readonly path: string[];
  public readonly value: number | BigNumber;
  public readonly from: 'number' | 'bignumber';
  public readonly to: CollNumRep;

  public constructor(path: string[], value: number | BigNumber, from: 'number' | 'bignumber', to: CollNumRep) {
    super(`Failed to coerce value from ${from} to ${to} at path: ${path.join('.')}`);
    this.path = path;
    this.value = value;
    this.from = from;
    this.to = to;
  }
}
