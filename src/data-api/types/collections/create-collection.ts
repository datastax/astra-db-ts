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
import { CollectionOptions } from '@/src/data-api/types';
import { WithTimeout } from '@/src/common/types';

/** @internal */
export interface CreateCollectionCommand {
  createCollection: {
    name: string;
    options: CollectionOptions<SomeDoc>;
  };
}

/**
 * Options for creating a new collection.
 *
 * @field vector - The vector configuration for the collection.
 * @field indexing - The indexing configuration for the collection.
 * @field defaultId - The default ID for the collection.
 * @field namespace - Overrides the namespace for the collection.
 * @field maxTimeMS - The maximum time to allow the operation to run.
 *
 * @see Db.createCollection
 */
export interface CreateCollectionOptions<Schema extends SomeDoc> extends WithTimeout, CollectionOptions<Schema>, WithNamespace {}
