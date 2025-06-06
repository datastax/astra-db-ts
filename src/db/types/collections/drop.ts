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

import type { CommandOptions } from '@/src/lib/index.js';
import type { WithKeyspace } from '@/src/db/index.js';

/**
 * Options for dropping a collections.
 *
 * @field keyspace - Overrides the keyspace for the collections.
 * @field timeout - The timeout override for this method
 *
 * @see Db.dropCollection
 *
 * @public
 */
export interface DropCollectionOptions extends CommandOptions<{ timeout: 'collectionAdminTimeoutMs' }>, WithKeyspace {}
