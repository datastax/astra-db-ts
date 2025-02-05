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

import type { AstraAdminBlockingOptions, AstraDbCloudProvider } from '@/src/administration/types/index.js';


import type { DbOptions } from '@/src/client/index.js';
import type { WithTimeout } from '@/src/lib/index.js';

/**
 * Represents the options for creating a database.
 *
 * @field name - Name of the database--user friendly identifier
 * @field cloudProvider - Cloud provider where the database lives
 * @field region - Cloud region where the database is located
 *
 * @public
 */
export interface AstraDatabaseConfig {
  /**
   * Name of the database (user-friendly identifier)
   */
  name: string,
  /**
   * Cloud provider where the database lives
   */
  cloudProvider?: AstraDbCloudProvider,
  /**
   * The cloud region where the database is located.
   */
  region: string,
  /**
   * The default keyspace to use for the database.
   */
  keyspace?: string,
}

/**
 * Represents the options for creating a database (i.e. blocking options + timeout options + database spawn options).
 *
 * @public
 */
export type CreateAstraDatabaseOptions = AstraAdminBlockingOptions & WithTimeout<'databaseAdminTimeoutMs'> & {
  /**
   * Any options to override the default options set when creating the root {@link DataAPIClient}.
   */
  dbOptions?: DbOptions,
}
