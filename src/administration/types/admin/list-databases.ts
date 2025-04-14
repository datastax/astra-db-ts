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

import type { AstraDatabaseCloudProvider, AstraDatabaseStatus } from '@/src/administration/types/index.js';
import type { WithTimeout } from '@/src/lib/index.js';

/**
 * Represents all possible statuses of a database that you can filter by.
 *
 * @public
 */
export type AstraDatabaseStatusFilter = AstraDatabaseStatus | 'ALL' | 'NONTERMINATED';

/**
 * Represents all possible cloud providers that you can filter by.
 *
 * @public
 */
export type AstraDatabaseCloudProviderFilter = AstraDatabaseCloudProvider | 'ALL';

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
export interface ListAstraDatabasesOptions extends WithTimeout<'databaseAdminTimeoutMs'> {
  /**
   * Allows filtering so that databases in listed states are returned.
   */
  include?: AstraDatabaseStatusFilter,
  /**
   * Allows filtering so that databases from a given provider are returned.
   */
  provider?: AstraDatabaseCloudProviderFilter,
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
   * Optional parameter for pagination purposes. Pass the UUID of the last item on the previous page to get the next page.
   */
  startingAfter?: string,
}
