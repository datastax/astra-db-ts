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

import type { BaseOptions, InternalUpdateResult } from '@/src/data-api/types';

/**
 * Represents the options for the `replaceOne` command.
 *
 * @field upsert - If true, perform an insert if no documents match the filter.
 * @field sort - The sort order to pick which document to replace if the filter selects multiple documents.
 */
export interface ReplaceOneOptions extends BaseOptions {
  /**
   * If true, perform an insert if no documents match the filter.
   *
   * If false, do not insert if no documents match the filter.
   *
   * Defaults to false.
   * @defaultValue false
   */
  upsert?: boolean,
}

export type ReplaceOneResult = InternalUpdateResult<0 | 1>;
