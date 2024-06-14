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

import type { Projection, Sort } from '@/src/data-api/types';

/**
 * Options for the `find` method.
 *
 * @field sort - The sort order to pick which document to return if the filter selects multiple documents.
 * @field vector - An optional vector to use for the appropriate dimensionality to perform an ANN vector search on the collection.
 * @field projection - Specifies which fields should be included/excluded in the returned documents.
 * @field limit - Max number of documents to return in the lifetime of the cursor.
 * @field skip - Number of documents to skip if using a sort.
 * @field includeSimilarity - If true, include the similarity score in the result via the `$similarity` field.
 *
 * @see Collection.find
 *
 * @public
 */
export interface FindOptions {
  /**
   * The order in which to apply the update if the filter selects multiple documents.
   *
   * If multiple documents match the filter, only one will be updated.
   *
   * Defaults to `null`, where the order is not guaranteed.
   *
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
  /**
   * Specifies which fields should be included/excluded in the returned documents.
   *
   * If not specified, all fields are included.
   *
   * When specifying a projection, it's the user's responsibility to handle the return type carefully, as the
   * projection will, of course, affect the shape of the returned documents. It may be a good idea to cast
   * the returned documents into a type that reflects the projection to avoid runtime errors.
   *
   * @example
   * ```typescript
   * interface User {
   *   name: string;
   *   age: number;
   * }
   *
   * const collection = db.collection<User>('users');
   *
   * const doc = await collection.findOne({}, {
   *   projection: {
   *     _id: 0,
   *     name: 1,
   *   },
   *   vector: [.12, .52, .32],
   *   includeSimilarity: true,
   * }) as { name: string, $similarity: number };
   *
   * // Ok
   * console.log(doc.name);
   * console.log(doc.$similarity);
   *
   * // Causes type error
   * console.log(doc._id);
   * console.log(doc.age);
   * ```
   */
  projection?: Projection,
  /**
   * Max number of documents to return. Applies over the whole result set, not per page. I.e. if the
   * result set has 1000 documents and `limit` is 100, only the first 100 documents will be returned,
   * but it'll still be fetched in pages of some N documents, regardless of if N \< or \> 100.
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
   *
   * @defaultValue false
   *
   * @example
   * ```typescript
   * const doc = await collection.findOne({}, {
   *   sort: {
   *     $vector: [.12, .52, .32],
   *   },
   *   includeSimilarity: true,
   * });
   *
   * console.log(doc?.$similarity);
   * ```
   */
  includeSimilarity?: boolean;
  /**
   * If true, fetch the sort vector on the very first API call.
   *
   * If false, it won't fetch the sort vector until {@link FindCursor.getSortVector} is called.
   *
   * Note that this is *not* a requirement to use {@link FindCursor.getSortVector}—it simply saves it an extra API call
   * to fetch the sort vector.
   *
   * Set this to true if you're sure you're going to need the sort vector in the very near future.
   *
   * @example
   * ```typescript
   * const doc = await collection.findOne({}, {
   *   sort: {
   *     $vector: [.12, .52, .32],
   *   },
   *   includeSortVector: true,
   * });
   *
   * // sortVector is fetched during this call
   * const next = await cursor.next();
   *
   * // so no I/O is done here as the cursor already has the sortVector cached
   * const sortVector = await cursor.getSortVector();
   * ```
   */
  includeSortVector?: boolean;
}

/** @internal */
export interface InternalFindOptions {
  pagingState?: string;
  limit?: number;
  skip?: number;
  includeSimilarity?: boolean;
  includeSortVector?: boolean;
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
