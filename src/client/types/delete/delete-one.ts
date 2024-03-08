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

import { InternalDeleteResult } from '@/src/client/types/delete/delete-common';
import { SomeDoc, SortOption } from '@/src/client';
import { BaseOptions } from '@/src/client/types/common';

/** @internal */
export interface DeleteOneCommand {
  deleteOne: {
    filter: Record<string, unknown>;
    sort?: SortOption<any>;
  };
}

/**
 * Represents the options for the deleteOne command.
 *
 * @field sort - The sort order to pick which document to delete if the filter selects multiple documents.
 */
export interface DeleteOneOptions<Schema extends SomeDoc> extends BaseOptions {
  /**
   * The order in which to apply the update if the filter selects multiple documents.
   *
   * If multiple documents match the filter, only one will be updated.
   *
   * Defaults to `null`, where the order is not guaranteed.
   * @default null
   */
  sort?: SortOption<Schema>;
}

/**
 * Represents the result of a delete command.
 *
 * @field deletedCount - The number of deleted documents. Can be either 0 or 1.
 */
export type DeleteOneResult = InternalDeleteResult<0 | 1>;
