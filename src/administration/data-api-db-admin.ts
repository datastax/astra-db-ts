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

import {
  AdminBlockingOptions,
  AdminSpawnOptions,
  LocalCreateKeyspaceOptions,
  LocalCreateNamespaceOptions,
} from '@/src/administration/types';
import { DbAdmin } from '@/src/administration/db-admin';
import { WithTimeout } from '@/src/lib/types';
import { validateAdminOpts } from '@/src/administration/utils';
import { FindEmbeddingProvidersResult } from '@/src/administration/types/db-admin/find-embedding-providers';
import { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { Db } from '@/src/db';

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
 * const dbAdmin1 = db.admin({ environment: 'dse' );
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
  readonly #httpClient!: DataAPIHttpClient;
  readonly #db!: Db;

  /**
   * Use {@link Db.admin} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(db: Db, httpClient: DataAPIHttpClient, adminOpts?: AdminSpawnOptions) {
    super();
    validateAdminOpts(adminOpts);

    this.#httpClient = httpClient.forDbAdmin(adminOpts);
    this.#db = db;
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
  public override async findEmbeddingProviders(options?: WithTimeout): Promise<FindEmbeddingProvidersResult> {
    const resp = await this.#httpClient.executeCommand({ findEmbeddingProviders: {} }, { keyspace: null, maxTimeMS: options?.maxTimeMS });
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
  public override async listKeyspaces(options?: WithTimeout): Promise<string[]> {
    const resp = await this.#httpClient.executeCommand({ findKeyspaces: {} }, { maxTimeMS: options?.maxTimeMS, keyspace: null });
    return resp.status!.keyspaces;
  }

  /**
   * Lists the keyspaces in the database.
   *
   * This is now a deprecated alias for the strictly equivalent {@link DataAPIDbAdmin.listKeyspaces}, and will be removed
   * in an upcoming major version.
   *
   * @deprecated - Prefer {@link DataAPIDbAdmin.listKeyspaces} instead.
   */
  public override async listNamespaces(options?: WithTimeout): Promise<string[]> {
    const resp = await this.#httpClient.executeCommand({ findNamespaces: {} }, { maxTimeMS: options?.maxTimeMS, keyspace: null });
    return resp.status!.namespaces;
  }

  /**
   * Creates a new, additional, keyspace for this database.
   *
   * **NB. The operation will always wait for the operation to complete, regardless of the {@link AdminBlockingOptions}. Expect it to take roughly 8-10 seconds.**
   *
   * @example
   * ```typescript
   * await dbAdmin.createKeyspace('my_keyspace');
   *
   * await dbAdmin.createKeyspace('my_keyspace', {
   *   replication: {
   *     class: 'SimpleStrategy',
   *     replicatonFactor: 3,
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
  public override async createKeyspace(keyspace: string, options?: LocalCreateKeyspaceOptions): Promise<void> {
    if (options?.updateDbKeyspace) {
      this.#db.useKeyspace(keyspace);
    }

    const replication = options?.replication ?? {
      class: 'SimpleStrategy',
      replicationFactor: 1,
    };

    await this.#httpClient.executeCommand({ createKeyspace: { name: keyspace, options: { replication } } }, { maxTimeMS: options?.maxTimeMS, keyspace: null });
  }

  /**
   * Creates a new, additional, keyspace for this database.
   *
   * This is now a deprecated alias for the strictly equivalent {@link DataAPIDbAdmin.createKeyspace}, and will be removed
   * in an upcoming major version.
   *
   * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
   *
   * @deprecated - Prefer {@link DataAPIDbAdmin.createKeyspace} instead.
   */
  public override async createNamespace(keyspace: string, options?: LocalCreateNamespaceOptions): Promise<void> {
    if (options?.updateDbNamespace) {
      this.#db.useKeyspace(keyspace);
    }

    const replication = options?.replication ?? {
      class: 'SimpleStrategy',
      replicationFactor: 1,
    };

    await this.#httpClient.executeCommand({ createNamespace: { name: keyspace, options: { replication } } }, { maxTimeMS: options?.maxTimeMS, keyspace: null });
  }

  /**
   * Drops a keyspace from this database.
   *
   * **NB. The operation will always wait for the operation to complete, regardless of the {@link AdminBlockingOptions}. Expect it to take roughly 8-10 seconds.**
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
  public override async dropKeyspace(keyspace: string, options?: AdminBlockingOptions): Promise<void> {
    await this.#httpClient.executeCommand({ dropKeyspace: { name: keyspace } }, { maxTimeMS: options?.maxTimeMS, keyspace: null });
  }

  /**
   Drops a keyspace from this database.
   *
   * This is now a deprecated alias for the strictly equivalent {@link DataAPIDbAdmin.dropKeyspace}, and will be removed
   * in an upcoming major version.
   *
   * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
   *
   * @deprecated - Prefer {@link DataAPIDbAdmin.dropKeyspace} instead.
   */
  public override async dropNamespace(keyspace: string, options?: AdminBlockingOptions): Promise<void> {
    await this.#httpClient.executeCommand({ dropNamespace: { name: keyspace } }, { maxTimeMS: options?.maxTimeMS, keyspace: null });
  }

  private get _httpClient() {
    return this.#httpClient;
  }
}
