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

import type { Db } from '@/src/db/index.js';
import type { AstraAdminBlockingOptions } from '@/src/administration/types/admin/admin-common.js';
import type { CommandOptions, LitUnion } from '@/src/lib/index.js';
import type { AstraDbAdmin } from "@/src/administration/index.js";

/**
 * Some Astra database representation from which an ID can be extracted.
 * 
 * @public
 */
export type AstraDbLike = Db | AstraDbAdmin | string;

/**
 * Represents the possible statuses of a database clone operation.
 * 
 * @public
 */
export type AstraCloneStatus = LitUnion<'RUNNING' | 'DONE' | 'ERROR'>;

/**
 * Represents a database snapshot with its ID and timestamp.
 * 
 * @public
 */
export interface AstraSnapshot {
  /**
   * The unique identifier of the snapshot.
   */
  id: string;
  
  /**
   * The timestamp when the snapshot was created.
   */
  time: Date;
}

/**
 * Options for the cloneFrom operation.
 * 
 * @public
 */
export type AstraCloneFromOptions = AstraAdminBlockingOptions & CommandOptions<{ timeout: 'databaseAdminTimeoutMs' }> & {
  /**
   * Optional source region for the clone operation.
   */
  sourceRegion?: string;
};

/**
 * Options for the cloneStatus operation.
 * 
 * @public
 */
export type AstraCloneStatusOptions = CommandOptions<{ timeout: 'databaseAdminTimeoutMs' }>;

/**
 * Options for the listSnapshots operation.
 * 
 * @public
 */
export type AstraListSnapshotsOptions = CommandOptions<{ timeout: 'databaseAdminTimeoutMs' }> & {
  /**
   * Optional source region to filter snapshots.
   */
  sourceRegion?: string;
  
  /**
   * Optional start date to filter snapshots (RFC3339 timestamp).
   */
  from?: Date;
  
  /**
   * Optional end date to filter snapshots (RFC3339 timestamp).
   */
  to?: Date;
};
