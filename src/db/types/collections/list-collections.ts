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

import { WithTimeout } from '@/src/lib/types';
import { CollectionOptions, WithKeyspace } from '@/src/db';
import { SomeDoc } from '@/src/documents';

/**
 * Options for listing collections.
 *
 * @field nameOnly - If true, only the name of the collections is returned. If false, the full collections info is returned. Defaults to true.
 * @field keyspace - Overrides the keyspace to list collections from. If not provided, the default keyspace is used.
 * @field maxTimeMS - The maximum amount of time to allow the operation to run.
 *
 * @see Db.listCollections
 *
 * @public
 */
export interface ListCollectionsOptions extends WithTimeout, WithKeyspace {
  /**
   * If true, only the name of the collections is returned.
   *
   * If false, the full collections info is returned.
   *
   * Defaults to true.
   *
   * @example
   * ```typescript
   * const names = await db.listCollections({ nameOnly: true });
   * console.log(names); // [{ name: 'my-coll' }]
   *
   * const info = await db.listCollections({ nameOnly: false });
   * console.log(info); // [{ name: 'my-coll', options: { ... } }]
   * ```
   *
   * @defaultValue true
   */
  nameOnly?: boolean,
}

/**
 * Information about a collections, used when `nameOnly` is false in {@link ListCollectionsOptions}.
 *
 * @field name - The name of the collections.
 * @field options - The creation options for the collections.
 *
 * @see ListCollectionsOptions
 * @see Db.listCollections
 *
 * @public
 */
export interface FullCollectionInfo {
  /**
   * The name of the collections.
   */
  name: string,
  /**
   * The creation options for the collections (i.e. the `vector`, `indexing`, and `defaultId` fields).
   */
  options: CollectionOptions<SomeDoc>,
}
