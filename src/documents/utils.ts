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

declare const $ERROR: unique symbol;

/**
 * Represents some type-level error which forces immediate attention rather than failing at runtime.
 *
 * More inflexible type than `never`, and gives contextual error messages.
 *
 * @example
 * ```typescript
 * function unsupported(): TypeErr<'Unsupported operation'> {
 *   throw new Error('Unsupported operation');
 * }
 *
 * // Doesn't compile with error:
 * // Type TypeErr<'Unsupported operation'> is not assignable to type string
 * const result: string = unsupported();
 * ```
 *
 * @public
 */
export interface TypeErr<S> { [$ERROR]: S }

const DBComponentsRegex = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-([a-z0-9_-]+)\.apps\.astra(?:-(?:dev|test))?\.datastax\.com/i;

/**
 * @internal
 */
export function extractDbComponentsFromAstraUrl(uri: string): [string, string] | [] {
  try {
    const match = DBComponentsRegex.exec(new URL(uri).hostname);

    if (!match) {
      return [];
    }

    return [match[1].toLowerCase(), match[2].toLowerCase()];
  } catch (_) {
    return [];
  }
}

/**
 * @internal
 */
export const betterTypeOf = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value) && value.length === 0) {
    return 'Array[Empty]';
  }

  if (typeof value === 'object') {
    return value.constructor?.name ?? 'Object[NullProto]';
  }

  return typeof value;
};

/**
 * @internal
 */
export const mkInvArgsError = (exp: string, params: [string, string][], ...got: unknown[]): TypeError => {
  const names = params.map(([name]) => name).join(', ');
  const types = params.map(([, type]) => type).join(', ');
  return new TypeError(`Invalid argument(s) for \`${exp}(${names})\`; expected (${types}), got (${got.map(betterTypeOf).join(', ')})`);
};

/**
 * @internal
 */
export const mkWrongTypeError = (fieldName: string, expected: string, got: unknown): TypeError => {
  return new TypeError(`Expected '${fieldName}' to be of type '${expected}', but got '${betterTypeOf(got)}' (${got})`);
};
