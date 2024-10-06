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

/**
 * Checks if a type can possibly be some number
 *
 * @example
 * ```typescript
 * IsNum<string | number> === true
 * ```
 *
 * @public
 */
export type IsNum<T> = number extends T ? true : bigint extends T ? true : false

/**
 * Checks if a type can possibly be a date
 *
 * @example
 * ```typescript
 * IsDate<string | Date> === boolean
 * ```
 *
 * @public
 */
export type IsDate<T> = IsAny<T> extends true ? true : T extends Date | { $date: number } ? true : false

/**
 * Checks if a type is any
 *
 * @public
 */
export type IsAny<T> = true extends false & T ? true : false
