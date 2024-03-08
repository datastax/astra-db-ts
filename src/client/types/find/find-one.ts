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
import { BaseOptions, ProjectionOption, SortOption } from '@/src/client/types/common';

/** @internal */
export interface FindOneCommand {
  findOne: {
    filter: Record<string, unknown>;
    options?: FindOneOptions<any, boolean>;
    sort?: SortOption<any>;
    projection?: ProjectionOption<any>;
  };
}

/**
 * Represents the options for the `findOne` command.
 *
 * @field includeSimilarity - If true, include the similarity score in the result via the `$similarity` field.
 * @field sort - The sort order to pick which document to return if the filter selects multiple documents.
 * @field projection - Specifies which fields should be included/excluded in the returned documents.
 */
export interface FindOneOptions<Schema extends SomeDoc, GetSim extends boolean> extends BaseOptions {
  /**
   * The order in which to apply the update if the filter selects multiple documents.
   *
   * If multiple documents match the filter, only one will be updated.
   *
   * Defaults to `null`, where the order is not guaranteed.
   * @default null
   */
  sort?: SortOption<Schema>;
  /**
   * Specifies which fields should be included/excluded in the returned documents.
   *
   * If not specified, all fields are included.
   */
  projection?: ProjectionOption<Schema>;
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
export const findOneOptionsKeys = new Set(['includeSimilarity']);