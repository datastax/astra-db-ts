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

import type { DataAPIVector, Projection, SortDirection } from '@/src/documents/index.js';
import type { WithTimeout } from '@/src/lib/index.js';

/**
 * @public
 */
export type HybridSort = Record<string, SortDirection | string | number[] | DataAPIVector | HybridSortObject> & { $hybrid: string | HybridSortObject }

export interface HybridSortObject {
  $vectorize?: string,
  $lexical?: string,
  $vector?: number[] | DataAPIVector,
  [col: string]: string | number[] | DataAPIVector | undefined,
}

/**
 * Options for some generic `findAndRerank` command.
 *
 * @public
 */
export interface GenericFindAndRerankOptions extends WithTimeout<'generalMethodTimeoutMs'> {
  /**
   * The order in which to apply the update if the filter selects multiple records.
   *
   * Defaults to `null`, where the order is not guaranteed.
   */
  sort?: HybridSort,
  /**
   * The projection to apply to the returned records, to specify only a select set of fields to return.
   *
   * If using a projection, it is heavily recommended to provide a custom type for the returned records as a generic type-param to the `find` method.
   */
  projection?: Projection,
  /**
   * The maximum number of records to return in the lifetime of the cursor.
   *
   * Defaults to `null`, which means no limit.
   */
  limit?: number,
  hybridLimits?: number | Record<string, number>,
  rerankOn?: string,
  rerankQuery?: string,
  includeScores?: boolean,
}
