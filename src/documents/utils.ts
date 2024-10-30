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

import { SomeDoc } from '@/src/documents/collections';
import { Sort } from '@/src/documents/types';

declare const $ERROR: unique symbol;

/**
 * Represents some type-level error which forces immediate attention rather than failing at runtime.
 *
 * More inflexable type than `never`, and gives contextual error messages.
 *
 * @example
 * ```typescript
 * function unsupported(): TypeErr<'Unsupported operation'> {
 *   throw new Error('Unsupported operation');
 * }
 *
 * // Doesn't compile with error:
 * // Type TypeErr<'Unsupported operation'> is not assignable to type string
 * const result: string = unsupported();
 * ```
 *
 * @public
 */
export type TypeErr<S> = { [$ERROR]: S };

/**
 * @internal
 */
export function extractDbIdFromUrl(uri: string): string | undefined {
  return new URL(uri).hostname.match(/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)?.[0];
}

/**
 * @internal
 */
export function replaceAstraUrlIdAndRegion(uri: string, id: string, region: string): string {
  const url = new URL(uri);
  const parts = url.hostname.split('.');
  parts[0] = id + '-' + region;
  url.hostname = parts.join('.');
  return url.toString().slice(0, -1);
}

/**
 * @internal
 */
export const normalizedSort = (sort: SomeDoc): Sort => {
  const ret: Sort = {};

  for (const key in sort) {
    if (typeof sort[key] === 'string') {
      if (sort[key][0] === 'a') {
        ret[key] = 1;
      } else if (sort[key][0] === 'd') {
        ret[key] = -1;
      }
    } else {
      ret[key] = sort[key];
    }
  }

  return ret;
};
