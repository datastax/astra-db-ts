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

import type {
  SomeRow,
  TableIndexColumn,
  TableIndexOptions,
  TableTextIndexOptions,
  TableVectorIndexOptions,
} from "@/src/documents/index.js";
import type { CommandOptions } from "@/src/lib/index.js";
import type { WithKeyspace } from "@/src/db/index.js";

/**
 * Options for listing indexes.
 *
 * @see Db.listIndexes
 *
 * @public
 */
export interface ListIndexOptions extends CommandOptions<{ timeout: 'tableAdminTimeoutMs' }>, WithKeyspace {
  /**
   * If true, only the name of the tables is returned.
   *
   * If false, the full tables info is returned.
   *
   * Defaults to false.
   *
   * @example
   * ```typescript
   * // ['users_idx', 'posts_idx']
   * console.log(await table.listIndexes({ nameOnly: true }));
   *
   * // [{ name: 'users_idx', definition: { ... }, indexType: 'regular' }, ...]
   * console.log(await table.listIndexes({ nameOnly: false }));
   * ```
   *
   * @defaultValue false
   */
  nameOnly?: boolean,
}

/**
 * Information about an index, used when `nameOnly` is false in {@link ListIndexOptions}.
 *
 * @see ListIndexOptions
 * @see Table.listIndexes
 *
 * @public
 */
export type TableIndexDescriptor =
  & (TableRegularIndexDescriptor | TableTextIndexDescriptor | TableVectorIndexDescriptor | TableUnknownIndexDescriptor)
  & ({ name: string });

/**
 * Describes a normal index on a scalar, map, list, etc.
 *
 * @public
 */
export interface TableRegularIndexDescriptor {
  indexType: 'regular',
  column: TableIndexColumn<SomeRow>,
  definition: TableIndexOptions,
}

/**
 * Describes a text (lexical) index.
 *
 * @public
 */
export interface TableTextIndexDescriptor {
  indexType: 'text',
  column: TableIndexColumn<SomeRow>,
  definition: TableTextIndexOptions,
}

/**
 * Describes a vector index.
 *
 * @public
 */
export interface TableVectorIndexDescriptor {
  indexType: 'vector',
  column: TableIndexColumn<SomeRow>,
  definition: TableVectorIndexOptions,
}

/**
 * Represents an unknown index in the off chance that the Data API was not able to recognize a special index created through CQL.
 *
 * @public
 */
export interface TableUnknownIndexDescriptor {
  indexType: 'UNKNOWN',
  column: 'UNKNOWN',
  definition: {
    apiSupport: {
      cqlDefinition: string,
      createIndex: boolean,
      filter: boolean,
    },
  },
}
