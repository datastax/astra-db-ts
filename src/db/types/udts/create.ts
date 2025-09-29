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

import type { CommandOptions, LitUnion } from '@/src/lib/index.js';
import type {
  DataAPICreatableScalarTypes,
  TableListColumnDefinition,
  TableMapColumnDefinition,
  TableScalarColumnDefinition, TableSetColumnDefinition, WithKeyspace,
} from '@/src/db/index.js';

/**
 * Options for creating a new user-defined type (via {@link Db.createType}).
 *
 * See {@link Db.createType} for more information.
 *
 * @public
 */
export interface CreateTypeOptions extends CommandOptions<{ timeout: 'tableAdminTimeoutMs' }>, WithKeyspace {
  /**
   * The definition of the UDT to create, including its fields.
   */
  definition: CreateTypeDefinition
  /**
   * If `true`, the operation will not fail if the UDT already exists.
   *
   * Defaults to `false`.
   */
  ifNotExists?: boolean,
}

/**
 * The definition for creating a new user-defined type through the Data API, using a bespoke schema definition syntax.
 *
 * See {@link Db.createType} for more info.
 *
 * @public
 */
export interface CreateTypeDefinition {
  /**
   * The fields to create in the UDT.
   */
  readonly fields: Record<string, LooseCreateTypeFieldDefinition | StrictCreateTypeFieldDefinition>,
}

/**
 * ##### Overview
 *
 * The loose field definition is a shorthand for the strict version, and follows the following example form:
 *
 * ```ts
 * fields: {
 *   name: 'text',
 *   age: 'int',
 * }
 * ```
 *
 * In this form, the key is the field name, and the value is the type of the scalar field.
 *
 * If you need to define a field with a more complex type (i.e., for maps, sets, lists), you must use the strict field definition.
 *
 * Plus, while it still provides autocomplete, the loose field definition does not statically enforce the type of the field, whereas the strict field definition does.
 *
 * @public
 */
export type LooseCreateTypeFieldDefinition = LitUnion<DataAPICreatableScalarTypes>

/**
 * ##### Overview
 *
 * The strict field definition is the more structured way to define a field, and follows the following example form:
 *
 * ```ts
 * fields: {
 *   id: { type: 'uuid' },
 *   tags: { type: 'set', valueType: 'text' },
 *   metadata: { type: 'map', keyType: 'text', valueType: 'int' },
 * }
 * ```
 *
 * In this form, the key is the field name, and the value is an object with a `type` field that specifies the type of the field.
 *
 * The object may also contain additional fields that are specific to the type of the field:
 * - For `map`, you _must_ specify the `keyType` and `valueType` fields.
 *   - The `keyType` must, for the time being, be either `'text'` or `'ascii'`.
 *   - The `valueType` must be a scalar type.
 * - For `list`s and `set`s, you _must_ specify the `valueType` field.
 *   - The `valueType` must be a scalar type.
 *
 * ##### The "loose" shorthand syntax
 *
 * If you're simply defining a scalar field, you can use the shorthand "loose" syntax instead, which is equivalent to the above for `id`:
 *
 * ```ts
 * fields: {
 *   id: 'uuid',
 * }
 * ```
 *
 * @public
 */
export type StrictCreateTypeFieldDefinition = TableScalarColumnDefinition;
