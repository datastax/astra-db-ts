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

import { AdminBlockingOptions, DatabaseCloudProvider } from '@/src/devops/types';

import { DbSpawnOptions } from '@/src/data-api';

/**
 * Represents the options for creating a database.
 *
 * @field name - Name of the database--user friendly identifier
 * @field cloudProvider - Cloud provider where the database lives
 * @field region - Cloud region where the database is located
 *
 * @public
 */
export interface DatabaseConfig {
  /**
   * Name of the database (user-friendly identifier)
   */
  name: string,
  /**
   * Cloud provider where the database lives
   */
  cloudProvider?: DatabaseCloudProvider,
  /**
   * The cloud region where the database is located.
   */
  region: string,
  /**
   * The default namespace to use for the database.
   */
  namespace?: string,
}

/**
 * Represents the options for creating a database (i.e. blocking options + database spawn options).
 *
 * @public
 */
export type CreateDatabaseOptions = AdminBlockingOptions & {
  /**
   * Any options to override the default options set when creating the root {@link DataAPIClient}.
   */
  dbOptions?: DbSpawnOptions,
}
