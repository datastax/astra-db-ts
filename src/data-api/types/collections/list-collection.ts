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

import { SomeDoc, WithNamespace } from '@/src/data-api';
import { BaseOptions, CollectionOptions } from '@/src/data-api/types';

/** @internal */
export interface ListCollectionsCommand {
  findCollections: {
    options: {
      explain: boolean,
    }
  }
}

/**
 * Options for listing collections.
 *
 * @field nameOnly - If true, only the name of the collection is returned. If false, the full collection info is returned. Defaults to true.
 * @field namespace - Overrides the namespace to list collections from. If not provided, the default namespace is used.
 * @field maxTimeMs - The maximum amount of time to allow the operation to run.
 *
 * @see Db.listCollections
 */
export interface ListCollectionsOptions extends BaseOptions, WithNamespace {
  /**
   * If true, only the name of the collection is returned.
   *
   * If false, the full collection info is returned.
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
 * The name of a collection, used when `nameOnly` is true or undefined in {@link ListCollectionsOptions}.
 *
 * @field name - The name of the collection.
 *
 * @see ListCollectionsOptions
 * @see Db.listCollections
 */
export interface CollectionName {
  /**
   * The name of the collection.
   */
  name: string,
}

/**
 * Information about a collection, used when `nameOnly` is false in {@link ListCollectionsOptions}.
 *
 * @field name - The name of the collection.
 * @field options - The creation options for the collection.
 *
 * @see ListCollectionsOptions
 * @see Db.listCollections
 */
export interface FullCollectionInfo {
  /**
   * The name of the collection.
   */
  name: string,
  /**
   * The creation options for the collection (i.e. the `vector`, `indexing`, and `defaultId` fields).
   */
  options: CollectionOptions<SomeDoc>,
}

/** @internal */
export const listCollectionOptionsKeys = new Set(['explain']);
