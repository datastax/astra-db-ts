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

import type { SomeDoc } from '@/src/data-api';
import type { BaseOptions, ProjectionOption, SortOption } from '@/src/data-api/types';

/** @internal */
export interface FindOneAndUpdateCommand {
  findOneAndUpdate: {
    filter?: Record<string, unknown>;
    update?: Record<string, any>;
    options?: {
      returnDocument: 'before' | 'after',
      upsert?: boolean,
    };
    sort?: SortOption<any>;
    projection?: ProjectionOption<any>;
  };
}

/**
 * Represents the options for the `findOneAndUpdate` command.
 *
 * @field returnDocument - Specifies whether to return the original or updated document.
 * @field upsert - If true, perform an insert if no documents match the filter.
 * @field sort - The sort order to pick which document to replace if the filter selects multiple documents.
 * @field vector - An optional vector to use for the appropriate dimensionality to perform an ANN vector search on the collection.
 * @field projection - Specifies which fields should be included/excluded in the returned documents.
 * @field includeResultMetadata - When true, returns alongside the document, an `ok` field with a value of 1 if the command executed successfully.
 *
 * @see Collection.findOneAndUpdate
 */
export interface FindOneAndUpdateOptions<Schema extends SomeDoc> extends BaseOptions {
  /**
   * Specifies whether to return the document before or after the update.
   *
   * Set to `before` to return the document before the update to see the original state of the document.
   *
   * Set to `after` to return the document after the update to see the updated state of the document immediately.
   */
  returnDocument: 'before' | 'after',
  /**
   * If true, perform an insert if no documents match the filter.
   *
   * If false, do not insert if no documents match the filter.
   *
   * Defaults to false.
   * @defaultValue false
   */
  upsert?: boolean,
  /**
   * The order in which to apply the update if the filter selects multiple documents.
   *
   * If multiple documents match the filter, only one will be updated.
   *
   * Defaults to `null`, where the order is not guaranteed.
   * @defaultValue null
   */
  sort?: SortOption<Schema>,
  /**
   * An optional vector to use of the appropriate dimensionality to perform an ANN vector search on the collection
   * to find the closest matching document.
   *
   * This is purely for the user's convenience and intuitiveness—it is equivalent to setting the `$vector` field in the
   * sort field itself. The two are interchangeable, but mutually exclusive.
   *
   * If the sort field is already set, an error will be thrown. If you really need to use both, you can set the $vector
   * field in the sort object directly.
   */
  vector?: number[],
  /**
   * @alpha
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
  projection?: ProjectionOption<Schema>,
  /**
   * When true, returns alongside the document, an `ok` field with a value of 1 if the command executed successfully.
   *
   * Otherwise, returns the document result directly.
   *
   * Defaults to false.
   * @defaultValue false
   */
  includeResultMetadata?: boolean,
}

/** @internal */
export const findOneAndUpdateOptionsKeys = new Set(['upsert', 'returnDocument']);
