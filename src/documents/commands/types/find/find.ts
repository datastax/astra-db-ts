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

import type { Projection, Sort } from '@/src/documents/index.js';
import type { WithTimeout } from '@/src/lib/index.js';

/**
 * Options for some generic `find` command.
 *
 * @field sort - The sort order to pick which document to return if the filter selects multiple documents.
 * @field projection - Specifies which fields should be included/excluded in the returned documents.
 * @field limit - Max number of documents to return in the lifetime of the cursor.
 * @field skip - Number of documents to skip if using a sort.
 * @field includeSimilarity - If true, include the similarity score in the result via the `$similarity` field.
 *
 * @public
 */
export interface GenericFindOptions extends WithTimeout<'generalMethodTimeoutMs'> {
  /**
   * The order in which to apply the update if the filter selects multiple records.
   *
   * Defaults to `null`, where the order is not guaranteed.
   */
  sort?: Sort,
  /**
   * The projection to apply to the returned records, to specify only a select set of fields to return.
   *
   * If using a projection, it is heavily recommended to provide a custom type for the returned records as a generic typeparam to the `find` method.
   */
  projection?: Projection,
  /**
   * The maximum number of records to return in the lifetime of the cursor.
   *
   * Defaults to `null`, which means no limit.
   */
  limit?: number,
  /**
   * The number of records to skip before starting to return records.
   *
   * Defaults to `null`, which means no skip.
   */
  skip?: number,
  /**
   * If true, include the similarity score in the result via the `$similarity` field.
   */
  includeSimilarity?: boolean;
  /**
   * If true, the sort vector will be available through `await cursor.getSortVector()`
   */
  includeSortVector?: boolean,
  /**
   * Sets the starting page state for the cursor.
   */
  initialPageState?: string | null,
  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - Use `sort: { $vector: [...] }` instead.
   */
  vector?: 'ERROR: Use `sort: { $vector: [...] }` instead',
  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - Use `sort: { $vectorize: '...' }` instead.
   */
  vectorize?: 'ERROR: Use `sort: { $vectorize: "..." }` instead',
}
