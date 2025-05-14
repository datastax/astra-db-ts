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

import type { AstraDatabaseCloudProvider } from './admin-common.js';
import type { CommandOptions } from '@/src/lib/index.js';

/**
 * ##### Overview
 *
 * The options for {@link AstraAdmin.findAvailableRegions}.
 *
 * @example
 * ```ts
 * const regions = await admin.findAvailableRegions({
 *   onlyOrgEnabledRegions: false,
 * });
 * ```
 *
 * @see AstraAdmin.findAvailableRegions
 * @see AstraAvailableRegionInfo
 * 
 * @public
 */
export interface AstraFindAvailableRegionsOptions extends CommandOptions<{ timeout: 'databaseAdminTimeoutMs' }> {
  /**
   * Whether to only return regions that are enabled for the current organization.
   *
   * - When `true` or unset: only returns regions enabled for the current organization.
   * - When `false`: returns all available regions, including those not enabled for the organization.
   *
   * Note that the organization is determined by the token used to authenticate the request.
   *
   * Defaults to `true`.
   */
  onlyOrgEnabledRegions?: boolean,
}

/**
 * ##### Overview
 * 
 * Represents the classification tier of an Astra database region.
 *
 * Region availability will depend on the user's account level.
 *
 * @see AstraAvailableRegionInfo
 *
 * @public
 */
export type AstraRegionClassification = 'standard' | 'premium' | 'premium_plus';

/**
 * ##### Overview
 * 
 * Represents the geographic zone where an Astra database region is located.
 * 
 * - `'na'`: North America
 * - `'emea'`: Europe, Middle East, and Africa
 * - `'apac'`: Asia Pacific
 * - `'sa'`: South America
 *
 * @see AstraAvailableRegionInfo
 * 
 * @public
 */
export type AstraRegionZone = 'na' | 'apac' | 'emea' | 'sa';

/**
 * ##### Overview
 * 
 * Information about an available region for Astra database deployments.
 * 
 * This provides details about each available region including classification, cloud provider, display name, and availability status.
 * 
 * @example
 * ```ts
 * // Basic usage
 * const regions = await admin.findAvailableRegions();
 * console.log(regions[0].displayName); // 'Moncks Corner, South Carolina'
 * 
 * // Further filterting & transformation may be done using native list methods
 * const awsRegions = regions.filter(region => region.cloudProvider === 'AWS');
 * ```
 *
 * @see AstraAdmin.findAvailableRegions
 * @see AstraFindAvailableRegionsOptions
 *
 * @public
 */
export interface AstraAvailableRegionInfo {
  /**
   * Represents the classification tier of an Astra database region.
   *
   * Region availability will depend on the user's account level.
   *
   * @example
   * ```ts
   * 'standard'
   * ```
   */
  classification: AstraRegionClassification,
  /**
   * The cloud provider hosting this region.
   *
   * @example
   * ```ts
   * 'GCP'
   * ```
   */
  cloudProvider: AstraDatabaseCloudProvider,
  /**
   * A human-readable display name for the region.
   *
   * @example
   * ```ts
   * 'Moncks Corner, South Carolina'
   * ```
   */
  displayName: string,
  /**
   * Whether this region is currently enabled for use.
   *
   * > **✏️Note:** If {@link AstraFindAvailableRegionsOptions.onlyOrgEnabledRegions} is `false`, and `enabled` is still `true`, it does not guarantee that the region is usable by the current organization.
   */
  enabled: boolean,
  /**
   * The unique identifier for the region.
   *
   * @example
   * ```ts
   * 'us-east1'
   * ```
   */
  name: string,
  /**
   * Whether this region is reserved for qualified users only, meaning special access is required to use it.
   */
  reservedForQualifiedUsers: boolean,
  /**
   * The geographic zone where this region is located.
   *
   * @example
   * ```ts
   * 'na'
   * ```
   */
  zone: AstraRegionZone,
}
