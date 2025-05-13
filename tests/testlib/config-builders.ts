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

import type { FinalVectorizeTestBranch } from '@/tests/testlib/vectorize/vec-test-branches.js';

const FilterState = {
  SoftOk: 1,
  SoftNo: 2,
  HardOk: 3,
  HardNo: 4,
};

export class FilterBuilder {
  constructor(private readonly _parts: string[], private readonly _combinator: 'and' | 'or') {}

  public build() {
    const rawFilters = this._parts
      .map((rawFilter) => (<const>{
        type: rawFilter.startsWith('f') ? 'match' : 'regex',
        inverted: rawFilter[1] === 'i',
        filter: rawFilter.slice(3),
      }));

    const filters = rawFilters
      .map((info) => {
        const filter = (info.type === 'regex')
          ? this._buildRegexFilter(info.filter)
          : this._buildMatchFilter(info.filter);

        return [filter, info.inverted] as const;
      })
      .map(([filter, inverted]) => {
        return (inverted)
          ? (name: string) => (filter(name) ? FilterState.HardNo : FilterState.SoftOk)
          : (name: string) => (filter(name) ? FilterState.HardOk : FilterState.SoftNo);
      });

    const test = (this._combinator === 'and')
      ? this._buildAndTestFn(filters)
      : this._buildOrTestFn(filters);

    return { test };
  };

  private _buildRegexFilter(filter: string) {
    const regex = RegExp(filter);
    return regex.test.bind(regex);
  }

  private _buildMatchFilter(filter: string) {
    return (name: string) => name.includes(filter);
  }

  private _buildAndTestFn(filters: ((name: string) => number)[]) {
    return (...names: string[]) => filters
      .map(filter => Math.max(...names.map(name => filter(name))))
      .every(s => s === FilterState.SoftOk || s === FilterState.HardOk);
  }

  private _buildOrTestFn(filters: ((name: string) => number)[]) {
    return (...names: string[]) => names
      .map(name => Math.max(...filters.map(filter => filter(name))))
      .some(s => s === FilterState.SoftOk || s === FilterState.HardOk);
  }
}

export class VecWhitelistBuilder {
  constructor(private readonly _whitelist: string, private readonly _inverted: boolean) {}

  public build() {
    const impl =
      (this._whitelist.startsWith('$limit:')
        ? new LimitWhitelist(this._whitelist, (_) => '') :
        this._whitelist.startsWith('$provider-limit:')
          ? new LimitWhitelist(this._whitelist, (t) => t.providerName) :
          this._whitelist.startsWith('$model-limit:')
            ? new LimitWhitelist(this._whitelist, (t) => t.providerName + t.modelName)
            : new RegexWhitelist(this._whitelist));

    const test = this._inverted
      ? (test: FinalVectorizeTestBranch) => !impl.test(test)
      : impl.test.bind(impl);

    return { test };
  }
}

class LimitWhitelist {
  private readonly _limit: number;
  private readonly _seen = new Map<string, number>();

  constructor(whitelist: string, readonly mkKey: (test: FinalVectorizeTestBranch) => string) {
    const args = whitelist.split(':')[1].split(',').filter((s) => s.trim() !== '');

    if (args.length !== 1) {
      throw new Error(`Invalid number of args for whitelist operator ${whitelist.split(':')[0]}; expected 1 arg, got ${args.length} (full whitelist: ${whitelist})`);
    }

    this._limit = +args[1];
  }

  public test(test: FinalVectorizeTestBranch) {
    const key = this.mkKey(test);

    const timesSeen = (this._seen.get(key) ?? 0) + 1;
    this._seen.set(key, timesSeen);

    return timesSeen <= this._limit;
  }
}

class RegexWhitelist {
  private readonly _regex: RegExp;

  constructor(whitelist: string) {
    this._regex = RegExp(whitelist);
  }

  public test(test: FinalVectorizeTestBranch) {
    return this._regex.test(test.branchName);
  }
}
