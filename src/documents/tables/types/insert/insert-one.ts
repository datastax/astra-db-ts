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

import type { GenericInsertOneOptions, SomeRow } from '@/src/documents/index.js';

/**
 * ##### Overview
 *
 * The options for an `insertOne` command on a {@link Table}.
 *
 * @example
 * ```ts
 * const result = await table.insertOne({
 *   id: 'john1234'
 *   name: 'John',
 * }, {
 *   timeout: 10000,
 * });
 * ```
 *
 * @see Table.insertOne
 * @see TableInsertOneResult
 *
 * @public
 */
export type TableInsertOneOptions = GenericInsertOneOptions;

/**
 * ##### Overview
 *
 * The options for an `insertOne` command on a {@link Table}.
 *
 * @example
 * ```ts
 * const res = await table.insertOne({
 *   id: '123',
 *   name: 'John'
 * });
 *
 * console.log(res.insertedId); // { id: '123' }
 * ```
 *
 * ---
 *
 * ##### The primary key type
 *
 * The type of the primary key of the table is inferred from the second type-param of the {@link Table}.
 *
 * If not set, it defaults to `Partial<RSchema>` to keep the result type consistent.
 *
 * See {@link InferTablePrimaryKey} about automatically inferring the primary key type from a {@link CreateTableDefinition}.
 *
 * @example
 * ```ts
 * interface User {
 *   id: string,
 *   name: string,
 *   dob?: DataAPIDate,
 * }
 *
 * type UserPKey = Pick<User, 'id'>;
 *
 * const table = db.table<User, UserPKey>('table');
 * const res = await table.insertOne({ id: '123', name: 'Alice' });
 *
 * // res.insertedId is of type { id: string }
 * console.log(res.insertedId.id); // '123'
 * console.log(res.insertedId.name); // type error
 * ```
 *
 * @field insertedId - The primary key of the inserted row.
 *
 * @see Table.insertOne
 * @see TableInsertOneOptions
 *
 * @public
 */
export interface TableInsertOneResult<PKey extends SomeRow> {
  /**
   * ##### Overview
   *
   * The primary key of the inserted (or upserted) row. This will be the same value as the primary key which was present in the row which was just inserted.
   *
   * See the {@link TableInsertOneOptions} for more information about the primary key.
   */
  insertedId: PKey;
}
