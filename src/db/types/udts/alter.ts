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

import type { SomeRow } from '@/src/documents/index.js';
import type { CreateTableColumnDefinitions, WithKeyspace } from '@/src/db/index.js';
import type { CommandOptions } from '@/src/lib/index.js';

/**
 * Options for altering a user-defined type (via {@link Db.alterType}).
 *
 * See {@link Db.alterType} for more information.
 *
 * @public
 */
export interface AlterTypeOptions<Schema extends SomeRow> extends CommandOptions<{ timeout: 'tableAdminTimeoutMs' }>, WithKeyspace {
  /**
   * The operations to perform on the UDT. Must pick just one of `add` or `rename`.
   */
  operation: AlterTypeOperations<Schema>,
}

/**
 * The possible alterations that may be performed on the UDT. Only one out of the two may be used at a time.
 *
 * @example
 * ```ts
 * // Add new fields
 * {
 *   add: {
 *     fields: {
 *       newField: 'text',
 *       anotherField: { type: 'int' },
 *     },
 *   },
 * }
 *
 * // Rename existing fields
 * {
 *   rename: {
 *     fields: {
 *       oldName: 'newName',
 *       street: 'streetAddress',
 *     },
 *   },
 * }
 * ```
 *
 * @public
 */
export interface AlterTypeOperations<Schema extends SomeRow> {
  /**
   * Add new fields to the UDT.
   */
  add?: AddFieldOperation,
  /**
   * Rename existing fields in the UDT.
   */
  rename?: RenameFieldOperation<Schema>,
}

/**
 * An operation to add fields to the UDT.
 *
 * @example
 * ```ts
 * {
 *   add: {
 *     fields: {
 *       country: 'text',
 *       postalCode: 'int',
 *       tags: { type: 'set', valueType: 'text' },
 *     },
 *   },
 * }
 * ```
 *
 * @public
 */
export interface AddFieldOperation {
  /**
   * The fields to add to the UDT, using the same format as in UDT creation.
   */
  fields: CreateTableColumnDefinitions,
}

/**
 * An operation to rename fields in the UDT.
 *
 * @example
 * ```ts
 * {
 *   rename: {
 *     fields: {
 *       street: 'streetAddress',
 *       zip: 'postalCode',
 *     },
 *   },
 * }
 * ```
 *
 * @public
 */
export interface RenameFieldOperation<Schema extends SomeRow> {
  /**
   * The fields to rename in the UDT, mapping from old field name to new field name.
   */
  fields: Partial<Record<keyof Schema & string, string>>,
}
