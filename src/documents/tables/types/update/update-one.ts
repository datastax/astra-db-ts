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

import type { GenericUpdateOneOptions } from '@/src/documents/index.js';

/**
 * Options for an `updateOne` command on a collection.
 *
 * @field upsert - If true, perform an insert if no documents match the filter.
 * @field sort - The sort order to pick which document to update if the filter selects multiple documents.
 * @field timeout - The timeout override for this method
 *
 * @see Collection.updateOne
 *
 * @public
 */
export type TableUpdateOneOptions = Omit<GenericUpdateOneOptions, 'upsert' | 'sort' | 'vector' | 'vectorize'>;
