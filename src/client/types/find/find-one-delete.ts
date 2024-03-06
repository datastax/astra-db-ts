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
import { SortOption } from '@/src/client/types/common';

// Internal
export interface FindOneAndDeleteCommand {
  findOneAndDelete: {
    filter?: Record<string, unknown>;
    sort?: SortOption<any>;
  };
}

/**
 * Represents the options for the `findOneAndDelete` command.
 *
 * @field sort - The sort order to pick which document to delete if the filter selects multiple documents.
 */
export interface FindOneAndDeleteOptions<Schema extends SomeDoc> {
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
