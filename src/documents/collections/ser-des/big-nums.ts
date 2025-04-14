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
import { unescapeFieldPath } from '@/src/lib/index.js';

/**
 * ##### Overview
 *
 * > **💡Tip:** read the documentation for {@link CollectionSerDesConfig.enableBigNumbers} before reading this.
 *
 * The `CollNumCoercion` type is used to define how numeric values should be coerced when deserializing data in collections.
 *
 * Each type of coercion has its own characteristics, and the choice of coercion should be well-thought-out, as misuse may lead to unexpected behavior and even damaged data.
 *
 * ---
 *
 * ##### Under the hood
 *
 * > **✏️Note:** in this context, "large" means that a number is not perfectly representable as a JS `number`.
 *
 * Under the hood, the specialized JSON parser converts every number to either a `number` or a `BigNumber`, depending on its size. From there, the coercion function is applied to the value to convert it to the desired type.
 *
 * **This means that coercion is applied after parsing, and certain coercions may fail if the value is not compatible with the coercion type.**
 * - For example, coercing a `BigNumber` to a `number` may fail if the value is too large to fit in a `number`.
 * - In this case, the coercion function will throw a {@link NumCoercionError} error.
 *
 * ---
 *
 * ##### Predefined coercions
 *
 * **Type:** `number`
 *   - **Description:** Coerces the value to a `number`, possibly losing precision if the value is too large.
 *   - **Throws?:** No.
 *
 * **Type:** `strict_number`
 *   - **Description:** Coerces the value to a `number`, only if the value not too large to be a `number`.
 *   - **Throws?:** Yes, if the value is too large to fit in a `number`.
 *
 * **Type:** `bigint`
 *   - **Description:** Coerces the value to a `bigint`, only if the value is an integer.
 *   - **Throws?:** Yes, if the value is not an integer.
 *
 * **Type:** `bignumber`
 *   - **Description:** Coerces the value to a `BigNumber`.
 *   - **Throws?:** No.
 *
 * **Type:** `string`
 *   - **Description:** Coerces the value to a `string`.
 *   - **Throws?:** No.
 *
 * **Type:** `number_or_string`
 *   - **Description:** Coerces the value to a `number` if it is not too large, otherwise coerces it to a `string`.
 *   - **Throws?:** No.
 *
 * ---
 *
 * ##### Custom coercions
 *
 * You can also use a custom coercion function as the coercion type, which takes the value and the path as arguments and returns the coerced value.
 *
 * @example
 * ```ts
 * const coll = db.collection('coll', {
 *   serdes: {
 *     enableBigNumbers: {
 *       '*': number,
 *       'items.*.price': (val, path) => {
 *          // nonsensical but demonstrative example
 *          const itemIndex = path[1];
 *          return BigNumber(value).times(itemIndex);
 *       },
 *     }
 *   },
 * });
 *
 * const { insertedId } = await coll.insertOne({
 *   itemCount: 3,
 *   items: [{ price: 10 }, { price: 20 }, { price: 30 }],
 * });
 *
 * const item = await coll.findOne({ _id: insertedId });
 *
 * console.log(item.itemCount); // 3
 * console.log(item.items[0].price); // BigNumber(0)
 * console.log(item.items[1].price); // BigNumber(20)
 * console.log(item.items[2].price); // BigNumber(60)
 * ```
 *
 * @see CollectionSerDesConfig.enableBigNumbers
 * @see CollNumCoercionFn
 * @see CollNumCoercionCfg
 * @see NumCoercionError
 *
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
 * ##### Overview
 *
 * > **💡Tip:** read the documentation for {@link CollectionSerDesConfig.enableBigNumbers} before reading this.
 *
 * This method of configuring the numerical deserialization behavior uses a function that takes the path of the field being deserialized, and returns the coercion type to be used for that path.
 *
 * If you'd prefer to use a more declarative approach, you can use the {@link CollNumCoercionCfg} type to define the coercion for each path.
 *
 * @example
 * ```ts
 * const coll = db.collection('coll', {
 *   serdes: {
 *     enableBigNumbers(path, matches) {
 *       if (path[0] === 'discount') {
 *         return 'bigint';
 *       }
 *
 *       if (matches(['items', '*', 'price'])) {
 *         return 'bignumber';
 *       }
 *
 *       return 'number';
 *     },
 *   }
 * });
 * ```
 *
 * ---
 *
 * ##### Using the function
 *
 * The function is called for each field being deserialized, and it receives two arguments:
 * - `path`: the path of the field being deserialized, as an array of strings.
 * - `matches`: a utility function that takes a "path matcher" as an argument and returns `true` if it matches the current path being deserialized.
 *
 * The matcher must be an array of strings and numbers, but it may also contain wildcards (`'*'`) to match any single field.
 * - The wildcard `'*'` matches a single element in the path at that position.
 *   - However, it will *not* match multiple elements (or no elements) in the path.
 *   - For example, `['foo', '*']` will match `['foo', 'bar']`, but _not_ `['foo']` or `['foo', 'bar', 'baz']`.
 * - Strings and numbers are strictly compared.
 *   - For example, `['foo', 1]` will _not_ match `['foo', '1']`.
 *   - The exception is the wildcard `'*'`, which will match any string or number.
 *
 * This function can then return any {@link CollNumCoercion} in order to coerce the value to the desired type.
 *
 * ---
 *
 * ##### Using a single {@link CollNumCoercion}
 *
 * You may simply use `() => '<type>'` to return a single coercion type for all paths.
 *
 * @see CollectionSerDesConfig.enableBigNumbers
 * @see CollNumCoercionCfg
 * @see CollNumCoercion
 *
 * @public
 */
export type CollNumCoercionFn = (path: readonly PathSegment[], matches: (path: readonly PathSegment[]) => boolean) => CollNumCoercion;

/**
 * ##### Overview
 *
 * > **💡Tip:** read the documentation for {@link CollectionSerDesConfig.enableBigNumbers} before reading this.
 *
 * This method of configuring the numerical deserialization behavior uses a configuration object that maps paths to coercion types.
 *
 * If you'd prefer to use a more flexible approach, you can use the {@link CollNumCoercionFn} type to define the coercion for each path.
 *
 * @example
 * ```ts
 * const orders = db.collection<Order>('orders', {
 *   serdes: {
 *     enableBigNumbers: {
 *       '*': 'number',
 *       'discount': 'bigint',
 *       'items.*.price': 'bignumber',
 *     },
 *   },
 * });
 * ```
 *
 * ---
 *
 * ##### The configuration object
 *
 * The configuration object is a map of paths to coercion types.
 *
 * These paths may also contain wildcards (`'*'`), which matches any single element in the path at that position.
 * - However, it will *not* match multiple elements (or no elements) in the path.
 * - For example, `'foo.*'` will match `'foo.bar'`, but _not_ `'foo'` or `'foo.bar.baz'`.
 *
 * Paths containing numbers (e.g. `'arr.0'`) will match both `arr: ['me!']` and `arr: { '0': 'me!' }`.
 *
 * > **🚨Important:** There must be a `'*'` key in the configuration object, which will be used as the default coercion for all paths that do not have a specific coercion defined.
 * > - This key is required, and the configuration will throw an error if it is not present.
 *
 * ---
 *
 * ##### Using a single {@link CollNumCoercion}
 *
 * You may simply use `{ '*': '<type>' }` to return a single coercion type for all paths.
 *
 * This is specifically optimized to be just as fast as using `() => '<type>'`.
 *
 * @see CollectionSerDesConfig.enableBigNumbers
 * @see CollNumCoercionFn
 * @see CollNumCoercion
 *
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
export const buildGetNumCoercionForPathFn = (cfg: ParsedSerDesConfig<CollectionSerDesConfig>): CollNumCoercionFn | undefined => {
  return (typeof cfg?.enableBigNumbers === 'object')
    ? collNumCoercionFnFromCfg(cfg.enableBigNumbers)
    : cfg?.enableBigNumbers;
};

const collNumCoercionFnFromCfg = (cfg: CollNumCoercionCfg): CollNumCoercionFn => {
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
    const keys = unescapeFieldPath(path);
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
export const coerceBigNumber = (value: BigNumber, path: readonly PathSegment[], getNumCoercionForPath: CollNumCoercionFn, pathMatches: (path: readonly PathSegment[]) => boolean): unknown => {
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
export const coerceNumber = (value: number, path: readonly PathSegment[], getNumCoercionForPath: CollNumCoercionFn, pathMatches: (path: readonly PathSegment[]) => boolean): unknown => {
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
export const coerceNums = (val: unknown, getNumCoercionForPath: CollNumCoercionFn) => {
  return coerceNumsImpl(val, [], getNumCoercionForPath, (p) => pathMatches([], p));
};

/**
 * @internal
 */
const coerceNumsImpl = (val: unknown, path: PathSegment[], getNumCoercionForPath: CollNumCoercionFn, pathMatchesFn: (path: readonly PathSegment[]) => boolean): unknown => {
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
