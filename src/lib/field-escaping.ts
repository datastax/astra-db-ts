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

import type { PathSegment } from '@/src/lib/types.js';

/**
 * ##### Overview (template-string overload)
 *
 * Escapes field names which may contain `.`s and `&`s for use in Data API queries.
 *
 * This overload allows you to use a tagged template string to create an escaped field path.
 *
 * > **🚨Important:** This should NOT be used for insertion operations. It is only for use in areas where a field path is required; not just a field name (e.g. filters, projections, updates, etc.)
 *
 * @example
 * ```ts
 * import { escapeFieldNames } from '@datastax/astra-db-ts';
 *
 * // 'websites.www&.datastax&.com.visits'
 * const domain = 'www.datastax.com';
 * escapeFieldNames`websites.${domain}.visits`
 *
 * // 'shows.tom&&jerry.episodes.3.views
 * const episode = 3;
 * escapeFieldNames`shows.${'tom&jerry'}.episodes.${episode}.views`
 * ```
 *
 * @see unescapeFieldPath
 *
 * @public
 */
export function escapeFieldNames(segments: TemplateStringsArray, ...args: PathSegment[]): string

/**
 * ##### Overview (varargs overload)
 *
 * Escapes field names which may contain `.`s and `&`s for use in Data API queries.
 *
 * This overload allows you to pass a variable number of arguments to create an escaped field path.
 *
 * > **🚨Important:** This should NOT be used for insertion operations. It is only for use in areas where a field path is required; not just a field name (e.g. filters, projections, updates, etc.)
 *
 * @example
 * ```ts
 * import { escapeFieldNames } from '@datastax/astra-db-ts';
 *
 * // 'websites.www&.datastax&.com.visits'
 * const domain = 'www.datastax.com';
 * escapeFieldNames('websites', domain, 'visits')
 *
 * // 'shows.tom&&jerry.episodes.3.views
 * const episode = 3;
 * escapeFieldNames('shows', 'tom&jerry', 'episodes', episode, 'views')
 * ```
 *
 * @see unescapeFieldPath
 *
 * @public
 */
export function escapeFieldNames(...segments: PathSegment[]): string

/**
 * ##### Overview (iterable overload)
 *
 * Escapes field names which may contain `.`s and `&`s for use in Data API queries.
 *
 * This over load allows you to pass an iterable (like an array) of segments to create an escaped field path.
 *
 * > **🚨Important:** This should NOT be used for insertion operations. It is only for use in areas where a field path is required; not just a field name (e.g. filters, projections, updates, etc.)
 *
 * @example
 * ```ts
 * import { escapeFieldNames } from '@datastax/astra-db-ts';
 *
 * // 'websites.www&.datastax&.com.visits'
 * const domain = 'www.datastax.com';
 * escapeFieldNames(['websites', domain, 'visits'])
 *
 * // 'shows.tom&&jerry.episodes.3.views
 * const episode = 3;
 * escapeFieldNames(['shows', 'tom&jerry', 'episodes', episode, 'views'])
 * ```
 *
 * @see unescapeFieldPath
 *
 * @public
 */
export function escapeFieldNames(segments: Iterable<PathSegment>): string

export function escapeFieldNames(segments: TemplateStringsArray | (string | number) | Iterable<string | number>, ...args: (string | number)[]): string {
  if (arguments.length === 0) {
    return '';
  }

  if (_isTemplateStringsArray(segments)) {
    return segments.map((str, i) => str + _escapeSegment(args[i] ?? '')).join('');
  }

  const arr: (string | number)[] =
    (typeof segments === 'string' || typeof segments === 'number')
      ? (args.unshift(segments), args) :
    (!Array.isArray(segments))
      ? [...segments]
      : segments;

  return arr.map(_escapeSegment).join('.');
}

function _escapeSegment(segment: string | number): string {
  if (typeof segment === 'number') {
    return segment.toString();
  }
  return segment.replace(/([.&])/g, '&$1');
}

function _isTemplateStringsArray(strs: TemplateStringsArray | (string | number) | Iterable<string | number>): strs is TemplateStringsArray {
  return Array.isArray(strs) && 'raw' in strs;
}

/**
 * ##### Overview
 *
 * Splits a field path into its individual segments, accounting for potentially escaped characters.
 *
 * > **✏️Note:** This is _not_ the exact inverse of {@link escapeFieldNames}, as while the former may encode numbers into strings, this function will always return strings.
 * >
 * >
 *
 * @example
 * ```ts
 * import { unescapeFieldPath } from '@datastax/astra-db-ts';
 *
 * // ['websites', 'www.datastax.com', 'visits']
 * unescapeFieldPath('websites.www&.datastax&.com.visits')
 *
 * // ['shows', 'tom&jerry', 'episodes', '3', 'views']
 * unescapeFieldPath('shows.tom&&jerry.episodes.3.views')
 * ```
 *
 * @public
 */
export function unescapeFieldPath(path: string): string[] {
  const ret = <string[]>[];
  let segment = '';

  if (!path) {
    return [];
  }

  if (!path.includes('&') && !path.includes('.')) {
    return [path];
  }

  if (path.startsWith('.')) {
    throw new Error(`Invalid field path '${path}'; '.' may not appear at the beginning of the path`);
  }

  for (let i = 0, n = path.length; i <= n; i++) {
    if (path[i] === '.' && i === n - 1) {
      throw new Error(`Invalid field path '${path}'; '.' may not appear at the end of the path`);
    }
    else if (path[i] === '.' || i === n) {
      if (!segment) {
        throw new Error(`Invalid field path '${path}'; empty segment found at position ${i}`);
      }
      ret.push(segment.slice()); // force rope flattening to reduce memory usage slightly
      segment = '';
    }
    else if (path[i] === '&') {
      if (i + 1 === n) {
        throw new Error(`Invalid escape sequence in field path '${path}'; '&' may not appear at the end of the path`);
      }

      const c = path[++i];

      if (c === '&' || c === '.') {
        segment += c;
      } else {
        throw new Error(`Invalid escape sequence in field path '${path}' at position ${i - 1}; '&' may not appear alone (must be used as either '&&' or '&.')`);
      }
    }
    else {
      segment += path[i];
    }
  }

  return ret;
}
