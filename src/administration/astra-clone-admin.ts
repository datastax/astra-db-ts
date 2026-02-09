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

import type { AstraDbAdmin } from '@/src/administration/astra-db-admin.js';
import type {
  AstraCloneFromOptions,
  AstraCloneStatus,
  AstraCloneStatusOptions,
  AstraListSnapshotsOptions,
  AstraSnapshot,
  AstraDbLike,
} from '@/src/administration/types/index.js';
import { idFromDbLike } from '@/src/administration/utils.js';
import { HttpMethods } from '@/src/lib/api/constants.js';
import type { DevOpsAPIHttpClient } from '@/src/lib/api/clients/devops-api-http-client.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import { HierarchicalLogger } from '@/src/lib/index.js';
import type { AdminCommandEventMap } from '@/src/administration/events.js';
import type { ParsedLoggingConfig } from "@/src/lib/logging/cfg-handler.js";

/**
 * An administrative class for managing database cloning operations for a specific Astra database.
 * 
 * **Shouldn't be instantiated directly; use {@link AstraDbAdmin.cloneAdmin} to obtain an instance of this class.**
 * 
 * @example
 * ```typescript
 * const dbAdmin = client.admin().dbAdmin('<endpoint>');
 * const cloneAdmin = dbAdmin.cloneAdmin();
 *
 * // List available snapshots
 * const snapshots = await cloneAdmin.listSnapshots();
 *
 * // Start a clone operation (blocking)
 * const operationId = await cloneAdmin.cloneFrom('<db_id>', {
 *   snapshotId: snapshots[0].id,
 * });
 *
 * // Start a clone operation (non-blocking)
 * const operationId = await cloneAdmin.cloneFrom('<db_id>', {
 *   snapshotId: snapshots[0].id,
 *   sourceRegion: 'us-east-1',
 *   blocking: false,
 * });
 * 
 * // Check clone status
 * const status = await cloneAdmin.cloneStatus(operationId);
 * ```
 * 
 * @see AstraDbAdmin.cloneAdmin
 * 
 * @public
 */
export class AstraDbCloneAdmin extends HierarchicalLogger<AdminCommandEventMap> {
  readonly #httpClient: DevOpsAPIHttpClient;
  readonly #targetDbId: string;

  /**
   * Use {@link AstraDbAdmin.cloneAdmin} to obtain an instance of this class.
   * 
   * @internal
   */
  constructor(dbAdmin: AstraDbAdmin, loggingConfig: ParsedLoggingConfig) {
    super(dbAdmin, loggingConfig);

    this.#httpClient = dbAdmin._httpClient as DevOpsAPIHttpClient;
    this.#targetDbId = dbAdmin.id;

    Object.defineProperty(this, $CustomInspect, {
      value: () => `AstraDbCloneAdmin(targetDb="${this.#targetDbId}")`,
    });
  }

  /**
   * Clones the target database from a source database.
   * 
   * **NB. this is a long-running operation. See {@link AstraAdminBlockingOptions} about such blocking operations.**
   * The default polling interval is 10 seconds.
   * 
   * @example
   * ```typescript
   * // List available snapshots
   * const snapshots = await cloneAdmin.listSnapshots();
   *
   * // Start a clone operation (blocking)
   * const operationId = await cloneAdmin.cloneFrom('<db_id>', {
   *   snapshotId: snapshots[0].id,
   * });
   *
   * // Start a clone operation (non-blocking)
   * const operationId = await cloneAdmin.cloneFrom('<db_id>', {
   *   snapshotId: snapshots[0].id,
   *   sourceRegion: 'us-east-1',
   *   blocking: false,
   * });
   * ```
   * 
   * @param from - The source database (Db instance or database ID string)
   * @param snapshotId - Optional snapshot ID to clone from
   * @param options - Options for the clone operation
   * 
   * @returns A promise that resolves to the operation ID
   */
  public async cloneFrom(from: AstraDbLike, snapshotId?: string, options?: AstraCloneFromOptions): Promise<string> {
    const sourceDbId = idFromDbLike(from);
    
    const params: Record<string, string> = {};
    if (snapshotId) {
      params.snapshotID = snapshotId;
    }
    if (options?.sourceRegion) {
      params.sourceRegion = options.sourceRegion;
    }

    const tm = this.#httpClient.tm.multipart('databaseAdminTimeoutMs', options);

    const resp = await this.#httpClient.requestLongRunning({
      method: HttpMethods.Post,
      path: `/databases/${this.#targetDbId}/cloneFrom/${sourceDbId}`,
      params: Object.keys(params).length > 0 ? params : undefined,
      methodName: 'dbCloneAdmin.cloneFrom',
    }, {
      id: this.#targetDbId,
      target: 'ACTIVE',
      legalStates: ['INITIALIZING', 'PENDING', 'MAINTENANCE'],
      defaultPollInterval: 10000,
      timeoutManager: tm,
      options,
    });

    return resp.data!.operationID;
  }

  /**
   * Checks the status of a clone operation.
   * 
   * @example
   * ```typescript
   * const status = await cloneAdmin.cloneStatus('<operation_id>');
   * console.log(status); // 'RUNNING', 'DONE', or 'ERROR'
   * ```
   * 
   * @param operationId - The operation ID returned from cloneFrom
   * @param options - Options for the status check
   * 
   * @returns A promise that resolves to the clone operation status
   */
  public async cloneStatus(operationId: string, options?: AstraCloneStatusOptions): Promise<AstraCloneStatus> {
    const tm = this.#httpClient.tm.single('databaseAdminTimeoutMs', options);

    const resp = await this.#httpClient.request({
      method: HttpMethods.Get,
      path: `/databases/${this.#targetDbId}/cloneStatus/${operationId}`,
      methodName: 'dbCloneAdmin.cloneStatus',
    }, tm);

    return resp.data!.status as AstraCloneStatus;
  }

  /**
   * Lists available snapshots for the database.
   * 
   * @example
   * ```typescript
   * // List all snapshots
   * const snapshots = await cloneAdmin.listSnapshots();
   * 
   * // List snapshots with filters
   * const recentSnapshots = await cloneAdmin.listSnapshots({
   *   from: new Date('2026-01-01'),
   *   to: new Date('2026-02-01'),
   *   sourceRegion: 'us-east-1',
   * });
   * ```
   * 
   * @param options - Options for listing snapshots
   * 
   * @returns A promise that resolves to an array of snapshots
   */
  public async listSnapshots(options?: AstraListSnapshotsOptions): Promise<AstraSnapshot[]> {
    const params: Record<string, string> = {};

    if (options?.sourceRegion) {
      params.sourceRegion = options.sourceRegion;
    }
    if (options?.from) {
      params.from = options.from.toISOString();
    }
    if (options?.to) {
      params.to = options.to.toISOString();
    }

    const tm = this.#httpClient.tm.single('databaseAdminTimeoutMs', options);

    const resp = await this.#httpClient.request({
      method: HttpMethods.Get,
      path: `/databases/${this.#targetDbId}/snapshots`,
      params: params,
      methodName: 'dbCloneAdmin.listSnapshots',
    }, tm);

    const snapshots = resp.data!.snapshots;
    
    return snapshots.map((snapshot: any): AstraSnapshot => ({
      id: snapshot.id,
      time: new Date(snapshot.time),
    }));
  }
}
