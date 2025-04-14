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
 * ##### Overview
 *
 * Represents data about a region in which an Astra database is hosted.
 *
 * This includes the region name, the API endpoint to use when interacting with that region, and the created-at timestamp.
 *
 * Used within the `regions` field of {@link AstraFullDatabaseInfo}, which may include multiple region entries for multi-region databases.
 *
 * @public
 */
export interface AstraDatabaseRegionInfo {
  /**
   * The name of the region where the database is hosted, e.g. `us-east1`.
   */
  name: string,
  /**
   * The API endpoint for the region, e.g. `https://<db-id>-<region>.apps.astra.datastax.com`.
   */
  apiEndpoint: string,
  /**
   * A timestamp representing when this region was created.
   */
  createdAt: Date,
}

/**
 * ##### Overview
 *
 * Represents the complete metadata returned for an Astra database.
 *
 * This is returned from {@link AstraDbAdmin.info} and {@link AstraAdmin.dbInfo}, whereas {@link AstraPartialDatabaseInfo} is used for {@link Db.info}.
 *
 * @example
 * ```ts
 * const fullInfo = await db.admin().info(),
 *
 * // 'ACTIVE'
 * console.log(fullInfo.status),
 *
 * // 'https://<db-id>-<region>.apps.astra.datastax.com'
 * console.log(fullInfo.regions[0].apiEndpoint),
 * ```
 *
 * @see AstraBaseDatabaseInfo
 *
 * @public
 */
export interface AstraFullDatabaseInfo extends AstraBaseDatabaseInfo {
  /**
   * A timestamp representing when the database was initially created.
   */
  createdAt: Date,
  /**
   * A timestamp representing the most recent time the database was accessed (read/write).
   */
  lastUsed: Date,
  /**
   * Information about the regions in which the database is deployed.
   *
   * It should contain at least one value, but may have more for multi-region deployments.
   *
   * Contains the region name, API endpoint for that region, and the timestamp when that region was created.
   */
  regions: AstraDatabaseRegionInfo[],
  /**
   * The unique organization UUID that owns this database.
   */
  orgId: string,
  /**
   The unique user UUID that owns this database.
   */
  ownerId: string,
}

/**
 * ##### Overview
 *
 * Represents the partial metadata of a database, as returned from {@link Db.info}.
 *
 * For the {@link AstraFullDatabaseInfo}, use either {@link AstraDbAdmin.info} or {@link AstraAdmin.dbInfo}.
 *
 * This type includes a limited view of database properties, based on the {@link Db}'s region, sufficient for most runtime use cases, but perhaps not for all administrative operations.
 *
 * @example
 * ```ts
 * const partialInfo = await db.info();
 * console.log(partialInfo.region); // e.g. "us-west2"
 * ```
 *
 * @see AstraBaseDatabaseInfo
 * @see AstraFullDatabaseInfo
 *
 * @public
 */
export interface AstraPartialDatabaseInfo extends AstraBaseDatabaseInfo {
  /**
   * The region being used by the {@link Db} instance, extracted directly from the {@link Db.endpoint}.
   *
   * There may or may not be more regions available, but they are not listed here; see {@link AstraFullDatabaseInfo} for that.
   */
  region: string,
  /**
   * The region being used by the {@link Db} instance, the same as the {@link Db.endpoint}.
   *
   * There may or may not be more api endpoints available, 1:1 with the number of regions available, but they are not listed here; see {@link AstraFullDatabaseInfo} for that.
   */
  apiEndpoint: string,
}

/**
 * ##### Overview
 *
 * Represents the common properties shared by both {@link AstraPartialDatabaseInfo} and {@link AstraFullDatabaseInfo}.
 *
 * This includes identifiers, basic configuration, status, and environment details.
 *
 * @public
 */
export interface AstraBaseDatabaseInfo {
  /**
   * The unique UUID of the database.
   */
  id: string,
  /**
   * The user-provided name of the database.
   */
  name: string,
  /**
   * The list of keyspaces currently present in the database.
   *
   * The list may technically be empty in rare corner cases, if they have all been deleted, but it is quite unlikely.
   */
  keyspaces: string[],
  /**
   * The current status of the database.
   *
   * Common values include:
   * - `'PENDING'`
   * - `'ACTIVE'`
   * - `'DELETING'`
   * - `'HIBERNATED'`
   * - `'TERMINATED'`
   *
   * Status values indicate the provisioning/operational state of the database.
   *
   * {@link AstraDatabaseStatus} contains a large amount of possible statuses (though many are unlikely), but the enumeration is open to other statuses not mentioned.
   */
  status: AstraDatabaseStatus,
  /**
   * The cloud provider where the database is hosted.
   *
   * Valid values include `'AWS'`, `'GCP'`, and `'AZURE'`.
   */
  cloudProvider: AstraDatabaseCloudProvider,
  /**
   * The Astra environment in which the database is running.
   *
   * Not relevant for most users' usage.
   */
  environment: 'dev' | 'test' | 'prod',
  /**
   * The full raw response received from the DevOps API when querying for database metadata.
   *
   * This field is provided for inspection or debugging, and contains fields not explicitly typed/present in this interface.
   */
  raw: Record<string, any>,
}
