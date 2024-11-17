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

import type { WithTimeout } from '@/src/lib';
import { WithKeyspace } from '@/src/db';

/**
 * Options for dropping a collections.
 *
 * @field keyspace - Overrides the keyspace for the collections.
 * @field maxTimeMS - The maximum time to allow the operation to run.
 *
 * @see Db.dropCollection
 *
 * @public
 */
export interface DropCollectionOptions extends WithTimeout, WithKeyspace {}
