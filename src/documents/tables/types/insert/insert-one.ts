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

import type { KeyOf, SomeRow } from '@/src/documents';

/**
 * ##### Overview
 *
 * Represents the result of an `insertOne` command on a table.
 *
 * ##### Primary Key Inference
 *
 * The type of the primary key of the table (for the `insertedId`) is inferred from the type-level `$PrimaryKeyType` key in the schema.
 *
 * If it's not present, it will default to {@link SomeTableKey} (see {@link Table}, {@link $PrimaryKeyType} for more info).
 *
 * @example
 * ```ts
 * interface User extends Row<User, 'id'> {
 *   id: string,
 *   name: string,
 *   dob?: DataAPIDate,
 * }
 * const table = db.table<User>('table');
 *
 * // res.insertedId is of type { id: string }
 * const res = await table.insertOne({ id: '123', name: 'Alice' });
 * console.log(res.insertedId.id); // '123'
 * ```
 *
 * @example
 * ```ts
 * const table = db.table<SomeRow>('table');
 *
 * // res.insertedId is of type Record<string, any>
 * const res = await table.insertOne({ id: '123', name: 'Alice' });
 * console.log(res.insertedId.id); // '123'
 * console.log(res.insertedId.key); // undefined
 * ```
 *
 * @field insertedId - The primary key of the inserted document.
 *
 * @see Table.insertOne
 *
 * @public
 */
export interface TableInsertOneResult<Schema extends SomeRow> {
  /**
   * The primary key of the inserted document.
   *
   * See {@link TableInsertOneResult} for more info about this type and how it's inferred.
   */
  insertedId: KeyOf<Schema>;
}
