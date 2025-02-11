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
