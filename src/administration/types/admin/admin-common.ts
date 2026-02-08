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

import type { LitUnion } from '@/src/lib/index.js';

/**
 * Represents the available cloud providers that DataStax Astra offers for database hosting.
 *
 * @public
 */
export type AstraDatabaseCloudProvider = 'AWS' | 'GCP' | 'AZURE';

/**
 * Represents the possible statuses of a database.
 *
 * For future compatability reasons, the enumeration is intentionally left open-ended, in case statuses may be added or modified in the future.
 *
 * @public
 */
export type AstraDatabaseStatus = LitUnion<'ACTIVE' | 'ERROR' | 'DECOMMISSIONING' | 'DEGRADED' | 'HIBERNATED' | 'HIBERNATING' | 'INITIALIZING' | 'MAINTENANCE' | 'PARKED' | 'PARKING' | 'PENDING' | 'PREPARED' | 'PREPARING' | 'RESIZING' | 'RESUMING' | 'TERMINATED' | 'TERMINATING' | 'UNKNOWN' | 'UNPARKING' | 'SYNCHRONIZING' | 'ASSOCIATING'>;

/**
 * ##### Overview
 *
 * Options controlling the blocking behavior of certain admin operations.
 *
 * Some admin operations require repeatedly polling the database's status to check if said operation is complete.
 * These operations may be long- or short-running, but they are not instantaneous.
 *
 * By default, these operations **block** until completion, with a method-defined polling interval that can be overridden.
 *
 * Alternatively, you can opt for **non-blocking** behavior, in which case the operation returns immediately, leaving it up to the caller to manually determine completion.
 *
 * ---
 *
 * ##### Blocking
 *
 * When `blocking` is `true` (default), the operation will **not return** until it is *fully complete*.
 * Completion is determined by polling the database's status at a regular interval.
 *
 * You can customize the polling interval using the `pollInterval` option (in milliseconds).
 *
 * @example
 * ```ts
 * // Will block by default until the operation is complete.
 * const dbAdmin1 = await admin.createDatabase({ ... });
 *
 * // Blocks with a custom poll interval (e.g. every 5 seconds).
 * const dbAdmin2 = await admin.createDatabase({ ... }, {
 *   pollInterval: 5000,
 * });
 * ```
 *
 * ---
 *
 * ##### Non-blocking
 *
 * When `blocking` is `false`, the operation returns immediately after initiating the request.
 * It becomes your responsibility to check when the operation has completed.
 *
 * **Important:** In this mode, *resources will still not be usable until the operation finishes.*
 *
 * For instance:
 * - `createDatabase` returns an `AstraDbAdmin` object, but it won’t point to an active database until creation is complete.
 * - `createKeyspace` won't actually allow you to use that keyspace until the database is back to active.
 *
 * @example
 * ```ts
 * // Will return immediately without waiting for operation completion
 * //
 * // The AstraDbAdmin object is still returned, but it's not very useful
 * // until the operation completes.
 * const dbAdmin3 = await admin.createDatabase({...}, {
 *   blocking: false,
 * });
 * ```
 *
 * ---
 *
 * @field blocking - Whether to block the operation until it is complete *(default: `true`)*
 * @field pollInterval - The interval (in milliseconds) at which to poll the operation for completion *(optional)*
 *
 * @public
 */

export type AstraAdminBlockingOptions =
  | AstraPollBlockingOptions
  | AstraNoBlockingOptions;

/**
 * ##### Overview (See {@link AstraAdminBlockingOptions})
 *
 * This is one of the possible shapes for {@link AstraAdminBlockingOptions}, specifying **blocking** behavior.
 *
 * In this mode, operations will poll the database's status until the operation is fully complete.
 *
 * **Refer to {@link AstraAdminBlockingOptions} for full behavior details and examples.**
 *
 * @public
 */
export interface AstraPollBlockingOptions {
  /**
   * Whether to block the operation until it is complete.
   *
   * Set `blocking` to `true` or leave it unset to enable blocking, having the method poll until completion.
   */
  blocking?: true,
  /**
   * How often (in milliseconds) to poll the operation's status until it completes.
   *
   * Optional; if not set, a default poll interval, determined on a method-by-method basis, will be used.
   */
  pollInterval?: number,
}

/**
 * ##### Overview (See {@link AstraAdminBlockingOptions})
 *
 * This is one of the possible shapes for {@link AstraAdminBlockingOptions}, specifying **non-blocking** behavior.
 *
 * In this mode, the operation returns immediately after initiating the request. Completion must be checked manually.
 *
 * **Refer to {@link AstraAdminBlockingOptions} for full behavior details, examples, and important caveats.**
 *
 * @public
 */
export interface AstraNoBlockingOptions {
  /**
   * Whether to block the operation until it is complete.
   *
   * Set `blocking` to `false` to disable blocking, and have the method return without waiting for completion.
   */
  blocking: false;
}
