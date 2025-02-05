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

import type { SomeDoc } from '@/src/documents/collections/index.js';
import type { TimeoutDescriptor } from '@/src/lib/index.js';
import type { CollectionDefinition, CollectionOptions } from '@/src/db/index.js';

/**
 * Options for creating a new collection (via {@link Db.createCollection}).
 *
 * See {@link Db.createCollection} & {@link Collection} for more information.
 *
 * @field vector - The vector configuration for the collections.
 * @field indexing - The indexing configuration for the collections.
 * @field defaultId - The default ID for the collections.
 * @field keyspace - Overrides the keyspace for the collections.
 * @field timeout - The timeout override for this method
 *
 * @see Db.createCollection
 *
 * @public
 */
export interface CreateCollectionOptions<Schema extends SomeDoc> extends CollectionDefinition<Schema>, CollectionOptions {
  timeout?: number | Pick<Partial<TimeoutDescriptor>, 'collectionAdminTimeoutMs'>;
}
