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

import type { CommandOptions } from '@/src/lib/index.js';

/**
 * Options for creating a new index via {@link Table.createTextIndex}
 *
 * @public
 */
export interface TableCreateTextIndexOptions extends CommandOptions<{ timeout: 'tableAdminTimeoutMs' }> {
  /**
   * Options available for `text` and `ascii` indexes
   */
  options?: TableTextIndexOptions,
  /**
   * If `true`, no error will be thrown if the index already exists.
   *
   * Note that this does not check if the existing index is the same as the one attempting to be created; it simply
   * checks if the name is already in use.
   */
  ifNotExists?: boolean,
}

/**
 * Options available for `text` and `ascii` indexes
 *
 * @public
 */
export interface TableTextIndexOptions {
  analyzer?: string | Record<string, unknown>,
}
