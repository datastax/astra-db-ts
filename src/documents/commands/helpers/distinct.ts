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

import { SomeDoc } from '@/src/documents';

/**
 * @internal
 */
export const pullSafeProjection4Distinct = (path: string): string => {
  const split = path.split('.');

  if (split.some(p => !p)) {
    throw new Error('Path cannot contain empty segments');
  }

  let i, n;
  for (i = 0, n = split.length; i < n && isNaN(+split[i]); i++) { /* empty */ }

  split.length = i;
  return split.join('.');
};

/**
 * @internal
 */
export const mkDistinctPathExtractor = (path: string): (doc: SomeDoc) => any[] => {
  const values = [] as any[];

  const extract = (path: string[], index: number, value: any) => {
    if (value === undefined) {
      return;
    }

    if (index === path.length) {
      if (Array.isArray(value)) {
        values.push(...value);
      } else {
        values.push(value);
      }
      return;
    }

    const prop = path[index];

    if (Array.isArray(value)) {
      const asInt = parseInt(prop, 10);

      if (isNaN(asInt)) {
        for (let i = 0, n = value.length; i < n; i++) {
          extract(path, index, value[i]);
        }
      } else if (asInt < value.length) {
        extract(path, index + 1, value[asInt]);
      }
    } else if (value && typeof value === 'object') {
      extract(path, index + 1, value[prop]);
    }
  };

  return (doc: SomeDoc) => {
    extract(path.split('.'), 0, doc);
    return values;
  };
};
