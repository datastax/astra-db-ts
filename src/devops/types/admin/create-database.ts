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

import type { DatabaseCloudProvider } from '@/src/devops/types';

/**
 * Represents the options for creating a database.
 *
 * @field name - Name of the database--user friendly identifier
 * @field cloudProvider - Cloud provider where the database lives
 * @field region - Cloud region where the database is located
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
}

export type CreateDatabaseOptions =
  | CreateDatabaseBlockingOptions
  | CreateDatabaseAsyncOptions

export interface CreateDatabaseBlockingOptions {
  blocking?: true,
  pollInterval?: number,
}

export interface CreateDatabaseAsyncOptions {
  blocking: false,
}
