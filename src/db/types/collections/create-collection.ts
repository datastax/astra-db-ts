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
import { TimeoutDescriptor } from '@/src/lib';
import { CollectionOptions, CollectionSpawnOptions } from '@/src/db';

/**
 * Options for creating a new collection (via {@link Db.createCollection}).
 *
 * See {@link Db.createCollection} & {@link Collection} for more information.
 *
 * @field vector - The vector configuration for the collections.
 * @field indexing - The indexing configuration for the collections.
 * @field defaultId - The default ID for the collections.
 * @field keyspace - Overrides the keyspace for the collections.
 * @field maxTimeMS - The maximum time to allow the operation to run.
 *
 * @see Db.createCollection
 *
 * @public
 */
export interface CreateCollectionOptions<Schema extends SomeDoc> extends CollectionOptions<Schema>, CollectionSpawnOptions<Schema> {
  timeout?: number | Pick<Partial<TimeoutDescriptor>, 'collectionAdminTimeoutMs'>;
}
