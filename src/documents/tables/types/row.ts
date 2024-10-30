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

/**
 * ##### Overview
 *
 * A phantom type used to represent the primary key columns of a table row. This is used to help with type inference on
 * insertion operations, where the `insertedId(s)` are returned.
 *
 * You may want to use the {@link Row} utility type to avoid having to manually specify the primary key columns' types.
 *
 * ##### Formatting
 *
 * The value of this symbol should be an object with the primary key columns as keys, and their respective types as values.
 *
 * Note that there is no distinction between partition and clustering keys; they are all considered as part of the overall primary key.
 *
 * This may be also used with custom datatypes (see {@link TableSerDesConfig} for more info about them) as well.
 *
 * ##### Getting the schema's keys
 *
 * You may attempt to do `keyof Schema`, but run into an issue where the {@link $PrimaryKeyType} is included in the resulting
 * union (which you don't want). To avoid this, there is a custom utility type exposed, {@link Cols}, which will return
 * the keys of the schema without the {@link $PrimaryKeyType} in them.
 *
 * ##### Disclaimer
 *
 * **Note that the value of this symbol should never actually be set at runtime**; it is simply a phantom type (of sorts) to
 * help with type inference on insertion operations, where the `insertedId(s)` are returned.
 *
 * If `Row` is not extended, and `$PrimaryKeyType` is not used, the primary key columns will be inferred as a
 * dynamic (untyped) {@link SomeTableKey}.
 *
 * @example
 * ```ts
 * import { $PrimaryKeyType, CqlDate, UUID } from '@datastax/astra-db-ts';
 *
 * interface User {
 *   id: string,   // Partition key
 *   dob: CqlDate, // Clustering (partition sort) key
 *   friends: Map<string, UUID>,
 *   [$PrimaryKeyType]?: {
 *     id: string,
 *     dob: CqlDate,
 *   },
 * }
 *
 * const table = db.table<User>('users');
 *
 * const resp = await table.insertOne({
 *   id: 'user1',
 *   dob: new CqlDate('1990-01-01'),
 *   friends: new Map(), // he's a loner :(
 * });
 *
 * console.log(resp.insertedId.id); // 'user1'
 * console.log(resp.insertedId.dob); // CqlDate("1990-01-01")
 * ```
 *
 * @see Row
 * @see Cols
 * @see Table
 * @see TableSerDesConfig
 * @see SomeTableKey
 * @see SomeRow
 *
 * @public
 */
export declare const $PrimaryKeyType: unique symbol;
g
/**
 * ##### Overview
 *
 * A utility type to represent a table row's primary key, without needing to manually specify the primary key columns'
 * types through {@link $PrimaryKeyType} (which you can see for more info).
 *
 * This may be also used with custom datatypes (see {@link TableSerDesConfig} for more info about them) as well.
 *
 * ##### Getting the schema's keys
 *
 * You may attempt to do `keyof Schema`, but run into an issue where the {@link $PrimaryKeyType} is included in the resulting
 * union (which you don't want). To avoid this, there is a custom utility type exposed, {@link Cols}, which will return
 * the keys of the schema without the {@link $PrimaryKeyType} in them.
 *
 * ##### Disclaimer
 *
 * **Note that the value of this symbol should never actually be set at runtime**; it is simply a phantom type (of sorts) to
 * help with type inference on insertion operations, where the `insertedId(s)` are returned.
 *
 * If `Row` is not extended, and `$PrimaryKeyType` is not used, the primary key columns will be inferred as a
 * dynamic (untyped) {@link SomeTableKey}.
 *
 * @example
 * ```ts
 * import { Row, CqlDate, UUID } from '@datastax/astra-db-ts';
 *
 * // equivalent to:
 * // interface User {
 * //   id: string,   // Partition key
 * //   dob: CqlDate, // Clustering (partition sort) key
 * //   friends: Map<string, UUID>,
 * //   [$PrimaryKeyType]?: {
 * //     id: string,
 * //     dob: CqlDate,
 * //   },
 * // }
 * interface User extends Row<User, 'id' | 'dob'> {
 *   id: string,   // Partition key
 *   dob: CqlDate, // Clustering (partition sort) key
 *   friends: Map<string, UUID>,
 * }
 *
 * const table = db.table<User>('users');
 *
 * const resp = await table.insertOne({
 *   id: 'user1',
 *   dob: new CqlDate('1990-01-01'),
 *   friends: new Map(), // he's a loner :(
 * });
 *
 * console.log(resp.insertedId.id); // 'user1'
 * console.log(resp.insertedId.dob); // CqlDate("1990-01-01")
 * ```
 *
 * @see Table
 * @see Cols
 * @see $PrimaryKeyType
 * @see TableSerDesConfig
 * @see SomeRow
 * @see SomeTableKey
 *
 * @public
 */
export interface Row<Schema extends SomeRow, Columns extends keyof Schema> {
  [$PrimaryKeyType]?: {
    [P in Columns]: Schema[P];
  },
}
