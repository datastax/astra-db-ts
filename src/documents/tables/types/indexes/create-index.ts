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

import { WithTimeout } from '@/src/lib';

/**
 * Options for creating a new index via {@link Table.createIndex}
 *
 * @public
 */
export interface CreateTableIndexOptions extends WithTimeout<'tableAdminTimeoutMs'> {
  /**
   * Options available for `text` and `ascii` indexes
   */
  options?: TableIndexOptions,
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
export interface TableIndexOptions {
  /**
   * If `false`, enables searches on the column to be case-insensitive.
   *
   * Defaults to `true`.
   */
  caseSensitive?: boolean,
  /**
   * Whether to normalize Unicode characters and diacritics before indexing.
   *
   * Defaults to `false`.
   */
  normalize?: boolean,
  /**
   * Whether to convert non-ASCII characters to their US-ASCII equivalent before indexing.
   *
   * Defaults to `false`.
   */
  ascii?: boolean,
}
