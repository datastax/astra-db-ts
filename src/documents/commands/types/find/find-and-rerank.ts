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

import type { DataAPIVector, Projection } from '@/src/documents/index.js';
import type { WithTimeout } from '@/src/lib/index.js';

/**
 * @public
 */
export interface HybridSort {
  $hybrid: string | HybridSortObject,
}

/**
 * @public
 */
export interface HybridSortObject {
  $vectorize?: string,
  $lexical?: string,
  [col: string]: string | number[] | DataAPIVector | undefined,
}

/**
 * ##### Overview
 *
 * The options for a generic `findAndRerank` command performed on the Data API.
 *
 * @example
 * ```ts
 * const results = await collection.findAndRerank({
 *   category: 'books',
 * }, {
 *   sort: { $hybrid: { $vectorize: 'fantasy novels', $lexical: 'dragons' } },
 *   limit: 5,
 *   timeout: 10000,
 * });
 * ```
 *
 * ---
 *
 * ##### Builder methods
 *
 * You can also use fluent builder methods on the cursor:
 *
 * @example
 * ```ts
 * const cursor = collection.findAndRerank({ category: 'books' })
 *   .sort({ $hybrid: { $vectorize: 'fantasy novels', $lexical: 'dragons' } })
 *   .limit(5)
 *   .includeScores(true);
 *
 * const results = await cursor.toArray();
 * ```
 *
 * @see CollectionFindAndRerankOptions
 * @see TableFindAndRerankOptions
 *
 * @public
 */
export interface GenericFindAndRerankOptions extends WithTimeout<'generalMethodTimeoutMs'> {
  /**
   * The order in which to apply the update if the filter selects multiple records.
   *
   * See {@link FindAndRerankCursor.sort} for more details and examples.
   */
  sort?: HybridSort,
  /**
   * The projection to apply to the returned records, to specify only a select set of fields to return.
   *
   * See {@link FindAndRerankCursor.project} for more details and examples.
   */
  projection?: Projection,
  /**
   * The maximum number of records to return in the lifetime of the cursor.
   *
   * See {@link FindAndRerankCursor.limit} for more details and examples.
   */
  limit?: number,
  /**
   * The maximum number of records to retrieve in total or from each source during hybrid search.
   *
   * See {@link FindAndRerankCursor.hybridLimits} for more details and examples.
   */
  hybridLimits?: number | Record<string, number>,
  /**
   * Specifies the document field to use for the reranking step.
   *
   * See {@link FindAndRerankCursor.rerankOn} for more details and examples.
   */
  rerankOn?: string,
  /**
   * TSpecifies the query text to use for the reranking step.
   *
   * See {@link FindAndRerankCursor.rerankQuery} for more details and examples.
   */
  rerankQuery?: string,
  /**
   * If true, include the scores in the results via {@link RerankedResult.scores}.
   *
   * See {@link FindAndRerankCursor.includeScores} for more details and examples.
   */
  includeScores?: boolean,
  /**
   * If true, the sort vector will be available through `await cursor.getSortVector()` and `await cursor.fetchNextPage()`.
   *
   * See {@link FindAndRerankCursor.includeSortVector} for more details and examples.
   */
  includeSortVector?: boolean,
}
