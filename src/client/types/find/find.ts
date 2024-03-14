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

import { SomeDoc } from '@/src/client';
import { ProjectionOption, SortOption } from '@/src/client/types/common';

/**
 * Options for the `find` method
 */
export interface FindOptions<Schema extends SomeDoc, GetSim extends boolean> {
  /**
   * The order in which to apply the update if the filter selects multiple documents.
   *
   * **NB. Using sort loses pagination; you're limited to a single page of results.**
   *
   * Defaults to `null`, where the order is not guaranteed.
   * @default null
   */
  sort?: SortOption<Schema>,
  /**
   * Specifies which fields should be included/excluded in the returned documents.
   *
   * If not specified, all fields are included.
   */
  projection?: ProjectionOption<Schema>,
  /**
   * Max number of documents to return. Applies over the whole result set, not per page. I.e. if the
   * result set has 1000 documents and `limit` is 100, only the first 100 documents will be returned,
   * but it'll still be fetched in pages of some N documents, regardless of if N < or > 100.
   */
  limit?: number,
  /**
   * Number of documents to skip. **Only works if a sort is provided.**
   */
  skip?: number,
  /**
   * If true, include the similarity score in the result via the `$similarity` field.
   *
   * If false, do not include the similarity score in the result.
   *
   * Defaults to false.
   * @default false
   *
   * @example
   * ```typescript
   * const doc = await collection.findOne({
   *   $vector: [.12, .52, .32]
   * }, {
   *   includeSimilarity: true
   * });
   *
   * console.log(doc?.$similarity);
   * ```
   */
  includeSimilarity?: GetSim;
}

/** @internal */
export interface InternalFindOptions {
  pagingState?: string;
  limit?: number;
  skip?: number;
  includeSimilarity?: boolean;
}

/** @internal */
export interface InternalGetMoreCommand {
  find: {
    filter?: Record<string, unknown>;
    options?: InternalFindOptions;
    sort?: Record<string, unknown>;
    projection?: Record<string, unknown>;
  }
}

/** @internal */
export const internalFindOptionsKeys = new Set(['limit', 'skip', 'pagingState', 'includeSimilarity']);
