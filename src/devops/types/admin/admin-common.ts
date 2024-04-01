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


import { WithTimeout } from '@/src/common/types';

export type DatabaseCloudProvider = 'AWS' | 'GCP' | 'AZURE';

export type DatabaseTier = 'developer' | 'A5' | 'A10' | 'A20' | 'A40' | 'C10' | 'C20' | 'C40' | 'D10' | 'D20' | 'D40' | 'serverless';

export type DatabaseStatus = 'ACTIVE' | 'PENDING' | 'PREPARING' | 'PREPARED' | 'INITIALIZING' | 'PARKED' | 'PARKING' | 'UNPARKING' | 'TERMINATED' | 'TERMINATING' | 'RESIZING' | 'ERROR' | 'MAINTENANCE' | 'SUSPENDED' | 'UNKNOWN';

export type DatabaseAction = 'park' | 'unpark' | 'resize' | 'resetPassword' | 'addKeyspace' | 'addDatacenters' | 'terminateDatacenter' | 'getCreds' | 'terminate' | 'removeKeyspace' | 'removeMigrationProxy' | 'launchMigrationProxy';
/**
 * The options representing the blocking behavior of many admin operations.
 *
 * Said operations are typically require polling to determine completion. They may or may not be
 * extremely long-running, depending on the operation, but they are not instantaneous.
 *
 * The default behavior is to block until the operation is complete, with a `pollInterval` determined on a
 * method-by-method basis, but able to be overridden.
 *
 * Otherwise, it can be made "non-blocking" by setting `blocking` to `false`, where it's up to the caller
 * to determine when the operation is complete.
 *
 * @example
 * ```
 * // Will block by default until the operation is complete.
 * const dbAdmin1 = await admin.createDatabase({...});
 *
 * // Will not block until the operation is complete.
 * // Still returned an AstraDbAdmin object, but it's not very useful
 * // until the operation completes.
 * const dbAdmin2 = await admin.createDatabase({...}, {
 *   blocking: false,
 * });
 *
 * // Blocks with a custom poll interval (per 5s).
 * const dbAdmin3 = await admin.createDatabase({...}, {
 *   blocking: true,
 *   pollInterval: 5000,
 * });
 * ```
 *
 * @remarks
 * By "blocking", we mean that the operation will not return until the operation is complete, which is
 * determined by polling the operation at a regular interval. "Non-blocking" means that the operation
 * makes the initial request, but then returns immediately, leaving it up to the caller to determine
 * when the operation is complete.
 *
 * If it's chosen not to block, keep in mind that the objects that the operation returns may not be
 * fully usable, or even usable at all, until the operation is complete. createDatabase, for example,
 * returns an AstraDbAdmin object, but there's no initialized database for it to work on until the
 * database is fully created.
 *
 * @field blocking - Whether to block the operation until it is complete.
 * @field pollInterval - The interval at which to poll the operation for completion.
 */
export type AdminBlockingOptions =
  | PollBlockingOptions
  | NoBlockingOptions

/**
 * The options representing the blocking behavior of many admin operations.
 *
 * @field blocking - True or omitted to block until the operation is complete.
 * @field pollInterval - The interval (in MS) at which to poll the operation for completion.
 *
 * @see AdminBlockingOptions
 */
export interface PollBlockingOptions extends WithTimeout {
  /**
   * True or omitted to block until the operation is complete.
   */
  blocking?: true,
  /**
   * The interval (in MS) at which to poll the operation for completion.
   *
   * The default is determined on a method-by-method basis.
   */
  pollInterval?: number,
}

/**
 * The options representing the blocking behavior of many admin operations.
 *
 * @field blocking - False to not block until the operation is complete.
 *
 * @see AdminBlockingOptions
 */
export interface NoBlockingOptions extends WithTimeout {
  /**
   * False to not block until the operation is complete.
   */
  blocking: false,
}
