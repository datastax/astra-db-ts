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
// noinspection ExceptionCaughtLocallyJS

import type { DataAPICreateKeyspaceOptions } from '@/src/administration/types/index.js';
import { DbAdmin } from '@/src/administration/db-admin.js';
import type { OpaqueHttpClient, WithTimeout } from '@/src/lib/index.js';
import type { FindEmbeddingProvidersResult } from '@/src/administration/types/db-admin/find-embedding-providers.js';
import type { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client.js';
import type { Db } from '@/src/db/index.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import type { ParsedAdminOptions } from '@/src/client/opts-handlers/admin-opts-handler.js';
import type { DataAPIClient } from '@/src/client/data-api-client.js';
import { InternalLogger } from '@/src/lib/logging/internal-logger.js';
import type { ParsedRootClientOpts } from '@/src/client/opts-handlers/root-opts-handler.js';

/**
 * An administrative class for managing non-Astra databases, including creating, listing, and deleting keyspaces.
 *
 * **Shouldn't be instantiated directly; use {@link Db.admin} to obtain an instance of this class.**
 *
 * **Note that the `environment` parameter MUST match the one used in the `DataAPIClient` options.**
 *
 * @example
 * ```typescript
 * const client = new DataAPIClient('*TOKEN*');
 *
 * // Create an admin instance through a Db
 * const db = client.db('*ENDPOINT*');
 * const dbAdmin1 = db.admin({ environment: 'dse' });
 * const dbAdmin2 = db.admin({ environment: 'dse', adminToken: 'stronger-token' });
 *
 * await admin1.createKeyspace({
 *   replication: {
 *     class: 'NetworkTopologyStrategy',
 *     datacenter1: 3,
 *     datacenter2: 2,
 *   },
 * });
 *
 * const keyspaces = await admin1.listKeyspaces();
 * console.log(keyspaces);
 * ```
 *
 * @see Db.admin
 * @see DataAPIDbAdmin.dbAdmin
 *
 * @public
 */
export class DataAPIDbAdmin extends DbAdmin {
  readonly #httpClient: DataAPIHttpClient<'admin'>;
  readonly #db: Db;

  /**
   * Use {@link Db.admin} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(db: Db, client: DataAPIClient, httpClient: DataAPIHttpClient, rootOpts: ParsedRootClientOpts, adminOpts: ParsedAdminOptions) {
    const loggingConfig = InternalLogger.cfg.concat([rootOpts.dbOptions.logging, adminOpts.logging]);
    super(client, loggingConfig);

    this.#httpClient = httpClient.forDbAdmin(this, adminOpts);
    this.#db = db;

    Object.defineProperty(this, $CustomInspect, {
      value: () => `DataAPIDbAdmin()`,
    });
  }

  /**
   * Gets the underlying `Db` object. The options for the db were set when the `DataAPIDbAdmin` instance, or whatever
   * spawned it, was created.
   *
   * @example
   * ```typescript
   * const dbAdmin = client.admin().dbAdmin('<endpoint>', {
   *   keyspace: 'my-keyspace',
   *   useHttp2: false,
   * });
   *
   * const db = dbAdmin.db();
   * console.log(db.keyspace);
   * ```
   *
   * @returns The underlying `Db` object.
   */
  public override db(): Db {
    return this.#db;
  }

  /**
   * Returns detailed information about the availability and usage of the vectorize embedding providers available on the
   * current database (may vary based on cloud provider & region).
   *
   * @example
   * ```typescript
   * const { embeddingProviders } = await dbAdmin.findEmbeddingProviders();
   *
   * // ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002']
   * console.log(embeddingProviders['openai'].models.map(m => m.name));
   * ```
   *
   * @param options - The options for the timeout of the operation.
   *
   * @returns The available embedding providers.
   */
  public override async findEmbeddingProviders(options?: WithTimeout<'databaseAdminTimeoutMs'>): Promise<FindEmbeddingProvidersResult> {
    const resp = await this.#httpClient.executeCommand({ findEmbeddingProviders: {} }, {
      timeoutManager: this.#httpClient.tm.single('databaseAdminTimeoutMs', options),
      methodName: 'dbAdmin.findEmbeddingProviders',
      keyspace: null,
    });
    return resp.status as FindEmbeddingProvidersResult;
  }

  /**
   * Lists the keyspaces in the database.
   *
   * The first element in the returned array is the default keyspace of the database, and the rest are additional
   * keyspaces in no particular order.
   *
   * @example
   * ```typescript
   * const keyspaces = await dbAdmin.listKeyspaces();
   *
   * // ['default_keyspace', 'my_other_keyspace']
   * console.log(keyspaces);
   * ```
   *
   * @returns A promise that resolves to list of all the keyspaces in the database.
   */
  public override async listKeyspaces(options?: WithTimeout<'keyspaceAdminTimeoutMs'>): Promise<string[]> {
    const resp = await this.#httpClient.executeCommand({ findKeyspaces: {} }, {
      timeoutManager: this.#httpClient.tm.single('keyspaceAdminTimeoutMs', options),
      methodName: 'dbAdmin.listKeyspaces',
      keyspace: null,
    });
    return resp.status!.keyspaces;
  }

  /**
   * Creates a new, additional, keyspace for this database.
   *
   * **NB. The operation will always wait for the operation to complete, regardless of the {@link AstraAdminBlockingOptions}. Expect it to take roughly 8-10 seconds.**
   *
   * @example
   * ```typescript
   * await dbAdmin.createKeyspace('my_keyspace');
   *
   * await dbAdmin.createKeyspace('my_keyspace', {
   *   replication: {
   *     class: 'SimpleStrategy',
   *     replicationFactor: 3,
   *   },
   * });
   *
   * await dbAdmin.createKeyspace('my_keyspace', {
   *   replication: {
   *     class: 'NetworkTopologyStrategy',
   *     datacenter1: 3,
   *     datacenter2: 2,
   *   },
   * });
   * ```
   *
   * @param keyspace - The name of the new keyspace.
   * @param options - The options for the timeout & replication behavior of the operation.
   *
   * @returns A promise that resolves when the operation completes.
   */
  public override async createKeyspace(keyspace: string, options?: DataAPICreateKeyspaceOptions): Promise<void> {
    if (options?.updateDbKeyspace) {
      this.#db.useKeyspace(keyspace);
    }

    const replication = options?.replication ?? {
      class: 'SimpleStrategy',
      replicationFactor: 1,
    };

    await this.#httpClient.executeCommand({ createKeyspace: { name: keyspace, options: { replication } } }, {
      timeoutManager: this.#httpClient.tm.single('keyspaceAdminTimeoutMs', options),
      methodName: 'dbAdmin.createKeyspace',
      keyspace: null,
    });
  }

  /**
   * Drops a keyspace from this database.
   *
   * **NB. The operation will always wait for the operation to complete, regardless of the {@link AstraAdminBlockingOptions}. Expect it to take roughly 8-10 seconds.**
   *
   * @example
   * ```typescript
   * // ['default_keyspace', 'my_other_keyspace']
   * console.log(await dbAdmin.listKeyspaces());
   *
   * await dbAdmin.dropKeyspace('my_other_keyspace');
   *
   * // ['default_keyspace', 'my_other_keyspace']
   * console.log(await dbAdmin.listKeyspaces());
   * ```
   *
   * @param keyspace - The name of the keyspace to drop.
   * @param options - The options for the timeout of the operation.
   *
   * @returns A promise that resolves when the operation completes.
   */
  public override async dropKeyspace(keyspace: string, options?: WithTimeout<'keyspaceAdminTimeoutMs'>): Promise<void> {
    await this.#httpClient.executeCommand({ dropKeyspace: { name: keyspace } }, {
      timeoutManager: this.#httpClient.tm.single('keyspaceAdminTimeoutMs', options),
      methodName: 'dbAdmin.dropKeyspace',
      keyspace: null,
    });
  }

  public get _httpClient(): OpaqueHttpClient {
    return this.#httpClient;
  }
}
