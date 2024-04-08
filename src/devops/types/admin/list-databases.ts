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

import { DatabaseCloudProvider, DatabaseStatus, } from '@/src/devops/types';
import { WithTimeout } from '@/src/common/types';

/**
 * @public
 */
export type DatabaseStatusFilter = DatabaseStatus | 'ALL' | 'NONTERMINATED';

/**
 * @public
 */
export type DatabaseCloudProviderFilter = DatabaseCloudProvider | 'ALL';

/**
 * Represents the options for listing databases.
 *
 * @field include - Allows filtering so that databases in listed states are returned.
 * @field provider - Allows filtering so that databases from a given provider are returned.
 * @field limit - Specify the number of items for one page of data.
 * @field skip - Starting value for retrieving a specific page of results.
 *
 * @public
 */
export interface ListDatabasesOptions extends WithTimeout {
  /**
   * Allows filtering so that databases in listed states are returned.
   */
  include?: DatabaseStatusFilter,
  /**
   * Allows filtering so that databases from a given provider are returned.
   */
  provider?: DatabaseCloudProviderFilter,
  /**
   * Optional parameter for pagination purposes. Specify the number of items for one page of data.
   *
   * Should be between 1 and 100.
   *
   * Defaults to 25.
   *
   * @defaultValue 25
   */
  limit?: number,
  /**
   * Optional parameter for pagination purposes. Used as this value for starting retrieving a specific page of results.
   */
  skip?: number,
}
