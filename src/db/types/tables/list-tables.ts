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
 * The definition is very similar to {@link CreateTableDefinition}, except for a couple key differences. See {@link ListTableDefinition} for more information.
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
   * The name of the table.
   */
  name: string,
  /**
   * The definition of the table (i.e. the `columns` and `primaryKey` fields).
   *
   * Very similar to {@link CreateTableDefinition}, except for a couple key differences. See {@link ListTableDefinition} for more information.
   */
  definition: ListTableDefinition,
}

/**
 * ##### Overview
 *
 * The response type of {@link Db.listTables} (without `nameOnly: true`), which is very similar to {@link CreateTableDefinition}, except
 * for a couple key differences.
 *
 * ##### No shorthands
 *
 * Unlike {@link CreateTableDefinition}, `ListTableDefinition` does not return column nor primary key definitions in their shorthand notation, even if they were created with them.
 *
 * Instead, their full definitions are always returned, meaning, if you defined a table like so:
 *
 * ```ts
 * const table = db.schema.createTable('my_table', {
 *   definition: {
 *     columns: {
 *       id: 'uuid',
 *       name: 'text',
 *     }
 *     primaryKey: 'id',
 *   }
 * });
 * ```
 *
 * The returned `ListTableDefinition` would look like this:
 *
 * ```ts
 * {
 *   columns: {
 *     id: { type: 'uuid' },
 *     name: { type: 'text' },
 *   },
 *   primaryKey: {
 *     partitionKey: ['id'],
 *     partitionSort: {},
 *   },
 * }
 * ```
 *
 * ##### `apiSupport`
 *
 * If the table was created with any partially-supported or fully-unsupported types, the `apiSupport` field will be present on the column definition.
 *
 * If the column is unable to be created through the Data API, the column `type` will be exactly `'UNSUPPORTED'` and the `apiSupport` field will be present.
 *
 * However, it is possible for columns created through the Data API to also have the `apiSupport` field, if the column was created with a type that is partially unsupported.
 *
 * The `apiSupport` block dictates which operations are supported for the column; for example, if the column is unsupported for filtering on, the `filter` field will be `false`. Not all unsupported types are completely unusable.
 *
 * @field columns - The columns of the tables.
 * @field primaryKey - The primary key of the tables.
 *
 * @see CreateTableDefinition
 * @see ListTablesOptions
 * @see Db.listTables
 *
 * @public
 */
export interface ListTableDefinition {
  columns: ListTableColumnDefinitions,
  primaryKey: ListTablePrimaryKeyDefinition,
}

/**
 * ##### Overview
 *
 * The column definitions for a table, used in {@link ListTableDefinition}.
 *
 * The keys are the column names, and the values are the column definitions.
 *
 * ##### No shorthand
 *
 * Unlike {@link CreateTableDefinition}, `ListTableColumnDefinitions` does not return column definitions in their shorthand notation, even if they were created with them.
 *
 * See {@link ListTableDefinition} for more information.
 *
 * ##### `apiSupport`
 *
 * The column definitions may or may not include the `apiSupport` field, depending on the column's type.
 *
 * See {@link ListTableDefinition} for more information.
 *
 * @public
 */
export type ListTableColumnDefinitions = Record<string, ListTableKnownColumnDefinition | ListTableUnsupportedColumnDefinition>;

/**
 * ##### Overview
 *
 * The column definition for a table, used in {@link ListTableColumnDefinitions}.
 *
 * The definition is very similar to {@link StrictCreateTableColumnDefinition}, except for the potential of having a `apiSupport` field.
 *
 * ##### No shorthand
 *
 * Unlike {@link StrictCreateTableColumnDefinition}, `ListTableKnownColumnDefinition` does not return column definitions in their shorthand notation, even if they were created with them.
 *
 * See {@link ListTableDefinition} for more information.
 *
 * ##### `apiSupport`
 *
 * If the column can not be created through the Data API, the column `type` will be exactly `'UNSUPPORTED'` and the `apiSupport` field will be present. See {@link ListTableUnsupportedColumnDefinition} for more information.
 *
 * However, it is possible for columns created through the Data API to also have the `apiSupport` field, if the column was created with a type that is partially unsupported.
 *
 * The `apiSupport` block dictates which operations are supported for the column; for example, if the column is unsupported for filtering on, the `filter` field will be `false`. Not all unsupported types are completely unusable.
 *
 * @field apiSupport - The API support for the column.
 *
 * @see ListTableUnsupportedColumnDefinition
 *
 * @public
 */
export type ListTableKnownColumnDefinition = StrictCreateTableColumnDefinition & {
  apiSupport?: ListTableUnsupportedColumnApiSupport,
};

/**
 * ##### Overview
 *
 * The column definition for a table that is unsupported by the Data API, used in {@link ListTableColumnDefinitions}.
 *
 * The `apiSupport` block dictates which operations are supported for the column; for example, if the column is unsupported for filtering on, the `filter` field will be `false`. Not all unsupported types are completely unusable.
 *
 * @field type - The type of the column, which is always `'UNSUPPORTED'`.
 * @field apiSupport - The API support for the column.
 *
 * @public
 */
export interface ListTableUnsupportedColumnDefinition {
  type: 'UNSUPPORTED',
  apiSupport: ListTableUnsupportedColumnApiSupport,
}

/**
 * ##### Overview
 *
 * The API support for a column that is partially-supported or fully-unsupported by the Data API, used in {@link ListTableUnsupportedColumnDefinition}.
 *
 * ##### `cqlDefinition`
 *
 * The `cqlDefinition` column displays how the column is defined in CQL, e.g. `frozen<tuple<text, int>>`.
 *
 * This will be present for all columns with the `apiSupport` block, regardless of whether they can be represented by the Data API or not.
 *
 * ##### Other fields
 *
 * The other fields in the `apiSupport` block dictate which operations are supported for the column; for example, if the column is unsupported for filtering on, the `filter` field will be `false`. Not all unsupported types are completely unusable.
 *
 * @field createTable - Whether the column can be created through the Data API.
 * @field insert - Whether the column can be inserted into through the Data API.
 * @field read - Whether the column can be read from through the Data API.
 * @field filter - Whether the column can be filtered on through the Data API.
 * @field cqlDefinition - The CQL definition of the column.
 *
 * @public
 */
export interface ListTableUnsupportedColumnApiSupport {
  createTable: boolean,
  insert: boolean,
  read: boolean,
  filter: boolean,
  cqlDefinition: string,
}

/**
 * ##### Overview
 *
 * The primary key definition for a table, used in {@link ListTableDefinition}.
 *
 * The definition is very similar to {@link FullCreateTablePrimaryKeyDefinition}, except that the `partitionSort` field is always present.
 *
 * ##### No shorthand
 *
 * Unlike {@link CreateTablePrimaryKeyDefinition}, `ListTablePrimaryKeyDefinition` does not return primary key definitions in their shorthand notation, even if they were created with them.
 *
 * See {@link ListTableDefinition} for more information.
 *
 * @public
 */
export type ListTablePrimaryKeyDefinition = Required<FullCreateTablePrimaryKeyDefinition>;
