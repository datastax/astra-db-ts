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

import type { DatabaseCloudProvider, DatabaseTier } from '@/src/data-api/types';

/**
 * Represents the options for creating a database.
 *
 * @field name - Name of the database--user friendly identifier
 * @field keyspace - Keyspace (aka namespace) name in database, or "default_keyspace" if not passed
 * @field cloudProvider - Cloud provider where the database lives
 * @field tier - Compute power (vertical scaling) for the database
 * @field capacityUnits - Amount of space available (horizontal scaling) for the database
 * @field region - Cloud region where the database is located
 * @field user - The user to connect to the database
 * @field password - The password to connect to the database
 * @field dbType - Type of the serverless database, currently only supported value is “vector”
 */
export interface DatabaseConfig {
  /**
   * Name of the database--user friendly identifier
   */
  name: string,
  /**
   * Keyspace (aka namespace) name in database. If not passed, keyspace is created with name "default_keyspace"
   */
  keyspace?: string,
  /**
   * Cloud provider where the database lives
   */
  cloudProvider?: DatabaseCloudProvider,
  /**
   * Tier defines the compute power (vertical scaling) for the database, developer gcp is the free tier.
   */
  tier: DatabaseTier,
  /**
   * The amount of space available (horizontal scaling) for the database. For free tier the max CU's is 1, and 100
   * for CXX/DXX the max is 12 on startup.
   */
  capacityUnits: number,
  /**
   * The cloud region where the database is located.
   */
  region: string,
  /**
   * The user to connect to the database.
   */
  user: string,
  /**
   * The password to connect to the database.
   */
  password: string,
  /**
   * Type of the serverless database, currently only supported value is “vector”. "vector" creates a cassandra
   * database with vector support. Field not being inputted creates default serverless database.
   */
  dbType?: 'vector',
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
