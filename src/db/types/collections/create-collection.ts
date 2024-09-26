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

import { SomeDoc } from '@/src/documents/collections';
import { WithTimeout } from '@/src/lib/types';
import { CollectionOptions, CollectionSpawnOptions } from '@/src/db';

/** @internal */
export interface CreateCollectionCommand {
  createCollection: {
    name: string;
    options: CollectionOptions<SomeDoc>;
  };
}

/**
 * Options for creating a new collections.
 *
 * @field vector - The vector configuration for the collections.
 * @field indexing - The indexing configuration for the collections.
 * @field defaultId - The default ID for the collections.
 * @field keyspace - Overrides the keyspace for the collections.
 * @field maxTimeMS - The maximum time to allow the operation to run.
 * @field checkExists - Whether to check if the collections exists before creating it.
 *
 * @see Db.createCollection
 *
 * @public
 */
export interface CreateCollectionOptions<Schema extends SomeDoc> extends WithTimeout, CollectionOptions<Schema>, CollectionSpawnOptions {
  /**
   * If `true` or unset, runs an additional existence check before creating the collections, failing if the collections
   * with the same name already exists, raising a {@link CollectionAlreadyExistsError}.
   *
   * Otherwise, if `false`, the creation is always attempted, and the command will succeed even if the collections
   * with the given name already exists, as long as the options are the exact same (if options mismatch, it'll
   * throw a {@link DataAPIResponseError}).
   *
   * @defaultValue true
   */
  checkExists?: boolean;
}
