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

import process from 'node:process';

const FILTER_STATE = {
  SOFT_OK: 1,
  SOFT_NO: 2,
  HARD_OK: 3,
  HARD_NO: 4,
};

const RAW_FILTERS = (process.env.CLIENT_TESTS_FILTER ?? '')
  .slice(0, -1)
  .split('" ')
  .filter(Boolean)
  .map((rawFilter) => (<const>{
    type: rawFilter[0] === 'f' ? 'match' : 'regex',
    inverted: rawFilter[1] === 'i',
    filter: rawFilter.split('"')[1],
  }));

const FILTER_COMBINATOR = (process.env.CLIENT_TESTS_FILTER_COMBINATOR ?? 'and') as 'and' | 'or';

export const TEST_FILTER = (() => {
  const filters = RAW_FILTERS
    .map((info) => {
      const filter = (info.type === 'regex')
        ? buildRegexFilter(info.filter)
        : buildMatchFilter(info.filter);

      return [filter, info.inverted] as const;
    })
    .map(([filter, inverted]) => {
      return (inverted)
        ? (name: string) => (filter(name) ? FILTER_STATE.HARD_NO : FILTER_STATE.SOFT_OK)
        : (name: string) => (filter(name) ? FILTER_STATE.HARD_OK : FILTER_STATE.SOFT_NO);
    });

  const testFn = (FILTER_COMBINATOR === 'and')
    ? buildAndTestFn(filters)
    : buildOrTestFn(filters);

  return { test: testFn };
})();

function buildRegexFilter(filter: string) {
  const regex = RegExp(filter);
  return regex.test.bind(regex);
}

function buildMatchFilter(filter: string) {
  return (name: string) => name.includes(filter);
}

function buildAndTestFn(filters: ((name: string) => number)[]) {
  return (...names: string[]) => filters
    .map(filter => Math.max(...names.map(name => filter(name))))
    .every(s => s === FILTER_STATE.SOFT_OK || s === FILTER_STATE.HARD_OK);
}

function buildOrTestFn(filters: ((name: string) => number)[]) {
  return (...names: string[]) => names
    .map(name => Math.max(...filters.map(filter => filter(name))))
    .some(s => s === FILTER_STATE.SOFT_OK || s === FILTER_STATE.HARD_OK);
}
