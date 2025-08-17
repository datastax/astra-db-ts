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

import type { CommandOptions } from '@/src/lib/index.js';
import type { TableUnsupportedColumnApiSupport, StrictCreateTypeFieldDefinition, WithKeyspace } from '@/src/db/index.js';

/**
 * Options for listing user-defined types.
 *
 * @field nameOnly - If true, only the name of the UDTs is returned. If false, the full UDT info is returned. Defaults to false.
 * @field keyspace - Overrides the keyspace to list UDTs from. If not provided, the default keyspace is used.
 * @field timeout - The timeout overrides for this method
 *
 * @see Db.listTypes
 *
 * @public
 */
export interface ListTypesOptions extends CommandOptions<{ timeout: 'tableAdminTimeoutMs' }>, WithKeyspace {
  /**
   * If true, only the name of the UDTs is returned.
   *
   * If false, the full UDT info is returned.
   *
   * Defaults to false.
   *
   * @example
   * ```typescript
   * const names = await db.listTypes({ nameOnly: true });
   * console.log(names); // ['address', 'user_profile']
   *
   * const info = await db.listTypes({ nameOnly: false });
   * console.log(info); // [{ name: 'address', definition: { fields: { ... } } }]
   * ```
   *
   * @defaultValue false
   */
  nameOnly?: boolean,
}

/**
 * Information about a user-defined type, used when `nameOnly` is false in {@link ListTypesOptions}.
 *
 * The definition is very similar to {@link CreateTypeDefinition}, except for a couple key differences. See {@link ListTypeDefinition} for more information.
 *
 * @field name - The name of the UDT.
 * @field definition - The field definitions for the UDT.
 * @field apiSupport - Information about which Data API operations are supported for this UDT.
 *
 * @see ListTypesOptions
 * @see Db.listTypes
 *
 * @public
 */
export interface TypeDescriptor {
  /**
   * The name of the UDT.
   */
  name: string,
  /**
   * The field definitions for the UDT, if available.
   */
  definition?: ListTypeDefinition,
  /**
   * Information about which Data API operations are supported for this UDT.
   */
  apiSupport?: TableUnsupportedColumnApiSupport,
}

/**
 * The definition of a user-defined type as returned by the list operation.
 *
 * This is similar to {@link CreateTypeDefinition}, but uses only strict field definitions.
 *
 * @public
 */
export interface ListTypeDefinition {
  /**
   * The fields defined in the UDT.
   */
  readonly fields: Record<string, StrictCreateTypeFieldDefinition>,
}
