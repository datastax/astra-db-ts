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

import { $PrimaryKeyType } from '@/src/documents';

/**
 * ##### Overview
 *
 * Represents *some primary key* of a table. This is a generic type that represents some (any) table primary key with any
 * number & types of columns.
 *
 * It is analogous to {@link SomeRow}, just on the level of primary keys rather than rows.
 *
 * This is used as the "default"/"untyped" fallback for when the key can't be inferred from {@link KeyOf} (i.e. if
 * {@link $PrimaryKeyType} is not set on the schema).
 *
 * ##### Disclaimer
 *
 * **Be careful when using this, as it is untyped and can lead to runtime errors if the key's structure is not as expected.**
 *
 * Encountering this type is generally a side effect of either not typing your tables, or not including a {@link $PrimaryKeyType}
 * field in your table schema. See {@link Table}, {@link $PrimaryKeyType}, and/or {@link Row} for more information on how to avoid this.
 *
 * @example
 * ```ts
 * // Forgot to extend Row or include $PrimaryKeyType
 * interface User {
 *   id: UserID,
 *   name: string,
 * }
 *
 * const table = db.table<User>('my_table');
 *
 * const inserted = await table.insertOne({
 *   id: 'some_id',
 *   name: 'some_name',
 * });
 *
 * // This will error at runtime, obviously, but will still compile
 * console.log(inserted.insertedId.i.can['pick@whatever$I'].wan.t)
 * ```
 *
 * @see Table
 * @see SomeRow
 * @see KeyOf
 * @see $PrimaryKeyType
 * @see Row
 *
 * @public
 */
export type SomeTableKey = Record<string, any>;

export type FoundRow<Doc> = Omit<Doc, '$similarity'> & { $similarity?: number }

/**
 * ##### Overview
 *
 * A utility type that extracts the primary key type from a table schema. This is used to help with type inference on
 * insertion operations, where the `insertedId(s)` are returned.
 *
 * This is used in conjunction with {@link $PrimaryKeyType} to get the primary key type of some table schema.
 *
 * ##### Disclaimer
 *
 * If the schema does not have a {@link $PrimaryKeyType} field, this will default to {@link SomeTableKey}, which is untyped.
 * This can lead to runtime errors if the key's structure is not as expected.
 *
 * It is recommended to always include a {@link $PrimaryKeyType} field in your table schema to avoid this. See
 * {@link Table}, {@link $PrimaryKeyType}, and/or {@link Row} for more information.
 *
 * @example
 * ```ts
 * interface User extends Row<User, 'id' | 'dob'> {
 *   id: string,   // Partition key
 *   dob: CqlDate, // Clustering (partition sort) key
 *   friends: Map<string, UUID>,
 * }
 *
 * // equivalent to:
 * // type UserKey = { id: string, dob: CqlDate };
 * type UserKey = KeyOf<User>;
 * ```
 *
 * @see Table
 * @see Row
 * @see SomeTableKey
 * @see $PrimaryKeyType
 * @see SomeRow
 *
 * @public
 */
export type KeyOf<Schema> = Schema extends { [$PrimaryKeyType]?: infer PrimaryKey }
  ? PrimaryKey extends SomeTableKey
    ? PrimaryKey
    : 'ERROR: [$PrimaryKeyType] must be an object with string keys and any values, or undefined'
  : SomeTableKey;
