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
 * ##### Overview
 *
 * Represents *some row* in a table. This is a generic type that represents some (any) table row with any number & types
 * of columns. All it asks for is that the row be an object with string keys and any values.
 *
 * Equivalent to {@link SomeDoc} for collections.
 *
 * This can/will often be used as the "default", or "untyped" generic type when no specific/static type is provided/desired.
 * (e.g. `class Table<Schema extends SomeRow = SomeRow> { ... }`)
 *
 * ##### Disclaimer
 *
 * **Be careful when using this, as it is untyped and can lead to runtime errors if the row's structure is not as expected.**
 *
 * It can be an effective footgun (especially for tables, which are inherently typed), so it is recommended to use a
 * more specific type when possible.
 *
 * That is not to say it does not have its uses, from flexibility, to prototyping, to convenience, to working with
 * dynamic data, etc. Just be aware of the risks, especially for tables.
 *
 * @example
 * ```ts
 * const table = db.table<SomeRow>('my_table');
 *
 * await table.insertOne({
 *   'lets.you$insert': function () { return 'whatever you want' },
 * });
 * ```
 *
 * @see Table
 * @see SomeDoc
 * @see SomeTableKey
 *
 * @public
 */
export type SomeRow = Record<string, any>;
