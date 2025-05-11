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

import type { Projection, Sort, WithDeprecatedVectorSortOptions } from '@/src/documents/index.js';
import type { CommandOptions } from '@/src/lib/index.js';

/**
 * Represents the options for some generic `findOne` command.
 *
 * @field sort - The sort order to pick which document to return if the filter selects multiple documents.
 * @field projection - Specifies which fields should be included/excluded in the returned documents.
 * @field includeSimilarity - If true, include the similarity score in the result via the `$similarity` field.
 * @field timeout - The timeout override for this method
 *
 * @public
 */
export interface GenericFindOneOptions extends CommandOptions<{ timeout: 'generalMethodTimeoutMs' }>, WithDeprecatedVectorSortOptions {
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
   * If true, include the similarity score in the result via the `$similarity` field.
   */
  includeSimilarity?: boolean,
}
