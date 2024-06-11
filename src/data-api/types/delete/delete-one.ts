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

import type { Sort } from '@/src/data-api/types';
import { WithTimeout } from '@/src/common/types';

/** @internal */
export interface DeleteOneCommand {
  deleteOne: {
    filter: Record<string, unknown>;
    sort?: Sort;
  };
}

/**
 * Represents the options for the deleteOne command.
 *
 * @field sort - The sort order to pick which document to delete if the filter selects multiple documents.
 * @field vector - An optional vector to use of the appropriate dimensionality to perform an ANN vector search on the collection.
 *
 * @see Collection.deleteOne
 *
 * @public
 */
export interface DeleteOneOptions extends WithTimeout {
  /**
   * The order in which to apply the update if the filter selects multiple documents.
   *
   * If multiple documents match the filter, only one will be updated.
   *
   * Defaults to `null`, where the order is not guaranteed.
   * @defaultValue null
   */
  sort?: Sort,
  /**
   * An optional vector to use of the appropriate dimensionality to perform an ANN vector search on the collection
   * to find the closest matching document.
   *
   * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field in the
   * sort field itself. The two are interchangeable, but mutually exclusive.
   *
   * If the sort field is already set, an error will be thrown. If you really need to use both, you can set the $vector
   * field in the sort object directly.
   *
   * @deprecated - Prefer to use `sort: { $vector: [...] }` instead
   */
  vector?: number[],
  /**
   * NOTE: This feature is under current development.
   *
   * @deprecated - Prefer to use `sort: { $vectorize: '...' }` instead
   */
  vectorize?: string,
}

/**
 * Represents the result of a delete command.
 *
 * @field deletedCount - The number of deleted documents. Can be either 0 or 1.
 *
 * @see Collection.deleteOne
 *
 * @public
 */
export interface DeleteOneResult {
  /**
   * The number of deleted documents.
   */
  deletedCount: 0 | 1,
}
