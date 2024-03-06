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

import { CollectionOptions } from '@/src/client/types/collections/create-collection';
import { SomeDoc } from '@/src/client';

/** @internal */
export interface ListCollectionsCommand {
  findCollections: {
    options: {
      explain: boolean,
    }
  }
}

// Is 'nameOnly' instead of 'explain' to be more Mongo-esque. May change in the future.
/**
 * Options for listing collections.
 *
 * @field nameOnly - If true, only the name of the collection is returned. If false, the full collection info is returned. Defaults to false.
 */
export interface ListCollectionsOptions<NameOnly extends boolean> {
  /**
   * If true, only the name of the collection is returned.
   *
   * If false, the full collection info is returned.
   *
   * Defaults to false.
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
   * @default false
   */
  nameOnly?: NameOnly,
}

/**
 * Result of listing collections depending on if `nameOnly` is true or false.
 *
 * If `nameOnly` is true, an array of collection names is returned.
 *
 * If `nameOnly` is false, an array of collection info is returned.
 *
 * @example
 * ```typescript
 * const names = await db.listCollections({ nameOnly: true });
 * console.log(names); // [{ name: 'my-coll' }]
 *
 * const info = await db.listCollections();
 * console.log(info); // [{ name: 'my-coll', options: { ... } }]
 * ```
 */
export type CollectionInfo<NameOnly extends boolean> = NameOnly extends true
  ? Pick<FullCollectionInfo, 'name'>
  : FullCollectionInfo;

/**
 * Information about a collection.
 *
 * @field name - The name of the collection.
 * @field options - The creation options for the collection.
 */
interface FullCollectionInfo {
  /**
   * The name of the collection.
   */
  name: string,
  /**
   * The creation options for the collection (i.e. the `vector` and `indexing` fields).
   */
  options: CollectionOptions<SomeDoc>,
}

/** @internal */
export const listCollectionOptionsKeys = new Set(['explain']);
