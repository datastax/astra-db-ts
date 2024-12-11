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

import type { WithTimeout } from '@/src/lib';
import { FullCreateTablePrimaryKeyDefinition, StrictCreateTableColumnDefinition, WithKeyspace } from '@/src/db';

/**
 * Options for listing tables.
 *
 * @field nameOnly - If true, only the name of the tables is returned. If false, the full tables info is returned. Defaults to true.
 * @field keyspace - Overrides the keyspace to list tables from. If not provided, the default keyspace is used.
 * @field timeout - The timeout override for this method
 *
 * @see Db.listTables
 *
 * @public
 */
export interface ListTablesOptions extends WithTimeout<'tableAdminTimeoutMs'>, WithKeyspace {
  /**
   * If true, only the name of the tables is returned.
   *
   * If false, the full tables info is returned.
   *
   * Defaults to true.
   *
   * @example
   * ```typescript
   * const names = await db.listTables({ nameOnly: true });
   * console.log(names); // [{ name: 'my_table' }]
   *
   * const info = await db.listTables({ nameOnly: false });
   * console.log(info); // [{ name: 'my_table', options: { ... } }]
   * ```
   *
   * @defaultValue true
   */
  nameOnly?: boolean,
}

/**
 * Information about a table, used when `nameOnly` is false in {@link ListTablesOptions}.
 *
 * @field name - The name of the tables.
 * @field options - The creation options for the tables.
 *
 * @see ListTablesOptions
 * @see Db.listTables
 *
 * @public
 */
export interface TableDescriptor {
  /**
   * The name of the tables.
   */
  name: string,
  /**
   * The definition of the table (i.e. the `columns` and `primaryKey` fields).
   */
  definition: ListTableDefinition,
}

/**
 * @public
 */
export interface ListTableDefinition {
  columns: ListTableColumnDefinitions,
  primaryKey: ListTablePrimaryKeyDefinition,
}

/**
 * @public
 */
export type ListTableColumnDefinitions = Record<string, ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition>;

/**
 * @public
 */
export type ListTableKnownColumnDefinition = StrictCreateTableColumnDefinition;

/**
 * @public
 */
export interface ListTableUnsupportedColumnDefinition {
  type: 'UNSUPPORTED',
  apiSupport: ListTableUnsupportedColumnApiSupport,
}

/**
 * @public
 */
export interface ListTableUnsupportedColumnApiSupport {
  createTable: boolean,
  insert: boolean,
  read: boolean,
  cqlDefinition: string,
}

/**
 * @public
 */
export type ListTablePrimaryKeyDefinition = Required<FullCreateTablePrimaryKeyDefinition>;
