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
/* eslint-disable @typescript-eslint/no-empty-object-type -- Used for when intersection w/ {} is a "noop" */

import type { DataAPIEnvironments } from '@/src/lib/constants.js';
import type { TimeoutDescriptor } from '@/src/lib/api/index.js';
import type { RetryConfig } from '@/src/lib/api/retries/config.js';

/**
 * Shorthand type to represent some nullish value.
 *
 * @public
 */
export type nullish = null | undefined;

/**
 * All the available Data API backends the Typescript client recognizes.
 *
 * If using a non-Astra database as the backend, the `environment` option should be set in the `DataAPIClient` options,
 * as well as in the `db.admin()` options.
 *
 * @public
 */
export type DataAPIEnvironment = typeof DataAPIEnvironments[number];

/**
 * @internal
 */
export interface Ref<T> { ref: T }

/**
 * @internal
 */
export type Mut<T extends object> = {
  -readonly [K in keyof T]: T[K];
}

/**
 * Utility type to represent an empty object without eslint complaining.
 *
 * @public
 */
// eslint-disable-next-line -- Needs to be a type, not an interface
export type EmptyObj = {};

/**
 * Utility type to represent a value that can be either a single value or an array of values.
 *
 * @public
 */
export type OneOrMany<T> = T | readonly T[];

/**
 * Vendored from [type-fest](https://github.com/sindresorhus/type-fest/blob/main/source/literal-union.d.ts)
 *
 * Utility type to represent a union of literal types or a base type without sacrificing intellisense.
 *
 * @public
 */
export type LitUnion<LiteralType, BaseType = string> = LiteralType | (BaseType & Record<never, never>);

/**
 * Represents a path segment, when representing paths as arrays.
 *
 * For example, `['products', 0, 'price.usd']`, which equals the string path `products.0.price&.usd`.
 *
 * @public
 */
export type PathSegment = string | number;

/**
 * Utility type to represent a non-empty array.
 *
 * @public
 */
export type NonEmpty<T> = [T, ...T[]];

/**
 * Utility type to represent a readonly non-empty array.
 *
 * @public
 */
export type ReadonlyNonEmpty<T> = readonly [T, ...T[]];

/**
 * Specializes a usage of {@link CommandOptions}.
 *
 * @public
 */
export interface CommandOptionsSpec {
  timeout?: keyof TimeoutDescriptor,
}

/**
 * ##### Overview
 *
 * The base options for all methods which make a request to the Data API or the DevOps API.
 *
 * @example
 * ```ts
 * await collection.insertOne({ ... }, { timeout: 5000 });
 * ```
 *
 * @public
 */
export interface CommandOptions<Spec extends CommandOptionsSpec = Required<CommandOptionsSpec>> {
  /**
   * ##### Overview
   *
   * Lets you specify timeouts for individual methods, in two different formats:
   * - A subtype of {@link TimeoutDescriptor}, which lets you specify the timeout for specific categories.
   * - A number, which specifies the "happy path" timeout for the method.
   *   - In single-call methods, this sets both the request & overall method timeouts.
   *   - In multi-call methods, this sets the overall method timeout (request timeouts are kept as default).
   *
   * @example
   * ```ts
   * // Both `requestTimeoutMs` and `generalMethodTimeoutMs` are set to 1000ms.
   * await coll.insertOne({ ... }, { timeout: 1000 });
   *
   * // `requestTimeoutMs` is left as default, `generalMethodTimeoutMs` is set to 2000ms.
   * await coll.insertOne({ ... }, { timeout: { generalMethodTimeoutMs: 2000 } });
   *
   * // Both `requestTimeoutMs` and `generalMethodTimeoutMs` are set to 2000ms.
   * await coll.insertMany([...], {
   *   timeout: { requestTimeoutMs: 2000, generalMethodTimeoutMs: 2000 },
   * });
   * ```
   *
   * @example
   * ```ts
   * // `requestTimeoutMs` is left as default, `generalMethodTimeoutMs` is set to 2000ms.
   * await coll.insertMany([...], { timeout: 2000 });
   *
   * // `requestTimeoutMs` is left as default, `generalMethodTimeoutMs` is set to 2000ms.
   * await coll.insertMany([...], { timeout: { generalMethodTimeoutMs: 2000 } });
   *
   * // Both `requestTimeoutMs` and `generalMethodTimeoutMs` are set to 2000ms.
   * await coll.insertMany([...], {
   *   timeout: { requestTimeoutMs: 2000, generalMethodTimeoutMs: 2000 },
   * });
   * ```
   *
   * See {@link TimeoutDescriptor} for much more information.
   *
   * @see TimeoutDescriptor
   *
   * @public
   */
  timeout?: number | Pick<Partial<TimeoutDescriptor>, 'requestTimeoutMs' | Exclude<Spec['timeout'], undefined>>;
  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - The `maxTimeMS` option is no longer available; the timeouts system has been overhauled, and timeouts should now be set using `timeout`, and defaults in `timeoutDefaults`. You may generally Ctrl+R replace `maxTimeMS` with `timeout` to retain the same behavior.
   */
  maxTimeMS?: 'ERROR: The `maxTimeMS` option is no longer available; the timeouts system has been overhauled, and timeouts should now be set using `timeout`',
  retry?: RetryConfig,
  isSafelyRetryable?: boolean,
}
