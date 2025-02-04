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

import type { GenericDeleteOneOptions } from '@/src/documents/index.js';

/**
 * Represents the options for the deleteOne command.
 *
 * @field sort - The sort order to pick which document to delete if the filter selects multiple documents.
 * @field timeout - The timeout override for this method
 *
 * @see Collection.deleteOne
 *
 * @public
 */
export type CollectionDeleteOneOptions = GenericDeleteOneOptions;

/**
 * Represents the result of a delete command.
 *
 * @field deletedCount - The number of deleted documents. Can be either 0 or 1.
 *
 * @see Collection.deleteOne
 *
 * @public
 */
export interface CollectionDeleteOneResult {
  /**
   * The number of deleted documents.
   */
  deletedCount: 0 | 1,
}
