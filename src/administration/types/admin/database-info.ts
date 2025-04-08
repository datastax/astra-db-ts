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

/**
 * Information about a region where an Astra database is hosted.
 *
 * @public
 */
export interface AstraDatabaseRegionInfo {
  /**
   * The name of the region.
   */
  name: string,
  /**
   * The API endpoint for the region.
   */
  apiEndpoint: string,
  /**
   * When the region was created.
   */
  createdAt: Date,
}

/**
 * The database information returned from {@link AstraDbAdmin.info} & {@link AstraAdmin.dbInfo}.
 *
 * @public
 */
export interface AstraFullDatabaseInfo extends AstraBaseDatabaseInfo {
  /**
   * When the database was created.
   */
  createdAt: Date,
  /**
   * When the database was last used.x
   */
  lastUsed: Date,
  /**
   * The regions info for the database.
   */
  regions: AstraDatabaseRegionInfo[],
  /**
   * The organization ID that owns the database.
   */
  orgId: string,
  /**
   * The ID of the owner of the database.
   */
  ownerId: string,
}

/**
 * The database information returned from {@link Db.info}.
 *
 * @public
 */
export interface AstraPartialDatabaseInfo extends AstraBaseDatabaseInfo {
  region: string,
  apiEndpoint: string,
}

/**
 * Represents the base information about a database, which is common in both {@link AstraFullDatabaseInfo} and {@link AstraPartialDatabaseInfo}.
 *
 * @public
 */
export interface AstraBaseDatabaseInfo {
  /**
   * The ID of the database.
   */
  id: string,
  /**
   * The user-given name of the database.
   */
  name: string,
  /**
   * The databases's keyspaces; the list may be empty.
   */
  keyspaces: string[],
  /**
   * The current status of the daatbase.
   */
  status: AstraDatabaseStatus,
  /**
   * The cloud provided where the database is hosted.
   */
  cloudProvider: AstraDatabaseCloudProvider,
  /**
   * The Astra environment in which the database is running.
   */
  environment: 'dev' | 'test' | 'prod',
  /**
   * The raw response from the DevOps API for the database information.
   */
  raw: Record<string, any>,
}
