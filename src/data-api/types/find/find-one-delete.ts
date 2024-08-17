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
import { WithTimeout } from '@/src/common/types';

/** @internal */
export interface FindOneAndDeleteCommand {
  findOneAndDelete: {
    filter?: Record<string, unknown>,
    sort?: Sort,
    projection?: Projection,
  };
}

/**
 * Represents the options for the `findOneAndDelete` command.
 *
 * @field sort - The sort order to pick which document to delete if the filter selects multiple documents.
 * @field projection - Specifies which fields should be included/excluded in the returned documents.
 * @field includeResultMetadata - When true, returns alongside the document, an `ok` field with a value of 1 if the command executed successfully.
 * @field maxTimeMS - The maximum time to wait for a response from the server, in milliseconds.
 *
 * @see Collection.findOneAndDelete
 *
 * @public
 */
export interface FindOneAndDeleteOptions extends WithTimeout {
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
   * When true, returns alongside the document, an `ok` field with a value of 1 if the command executed successfully.
   *
   * Otherwise, returns the document result directly.
   *
   * Defaults to false.
   * @defaultValue false
   */
  includeResultMetadata?: boolean,
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
   * Akin to {@link FindOneAndDeleteOptions.vector}, but for `$vectorize`.
   *
   * @deprecated - Prefer to use `sort: { $vectorize: '...' }` instead
   */
  vectorize?: string,
}
