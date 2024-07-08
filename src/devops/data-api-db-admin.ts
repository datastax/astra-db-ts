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

import { AdminBlockingOptions, AdminSpawnOptions } from '@/src/devops/types';
import { DataAPIHttpClient } from '@/src/api';
import { Db } from '@/src/data-api';
import { DbAdmin } from '@/src/devops/db-admin';
import { WithTimeout } from '@/src/common/types';
import { validateAdminOpts } from '@/src/devops/utils';
import { LocalCreateNamespaceOptions } from '@/src/devops/types/db-admin/local-create-namespace';

/**
 * An administrative class for managing non-Astra databases, including creating, listing, and deleting namespaces.
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
 * await admin1.createNamespace({
 *   replication: {
 *     class: 'NetworkTopologyStrategy',
 *     datacenter1: 3,
 *     datacenter2: 2,
 *   },
 * });
 *
 * const namespaces = await admin1.listNamespaces();
 * console.log(namespaces);
 * ```
 *
 * @see Db.admin
 * @see AstraDbAdmin.dbAdmin
 *
 * @public
 */
export class DataAPIDbAdmin extends DbAdmin {
  private readonly _httpClient!: DataAPIHttpClient;
  private readonly _db!: Db;

  /**
   * Use {@link Db.admin} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(db: Db, httpClient: DataAPIHttpClient, adminOpts?: AdminSpawnOptions) {
    super();

    validateAdminOpts(adminOpts);

    Object.defineProperty(this, '_httpClient', {
      value: httpClient.forDbAdmin(adminOpts),
      enumerable: false,
    });

    Object.defineProperty(this, '_db', {
      value: db,
      enumerable: false,
    });
  }

  /**
   * Gets the underlying `Db` object. The options for the db were set when the `DataAPIDbAdmin` instance, or whatever
   * spawned it, was created.
   *
   * @example
   * ```typescript
   * const dbAdmin = client.admin().dbAdmin('<endpoint>', {
   *   namespace: 'my-namespace',
   *   useHttp2: false,
   * });
   *
   * const db = dbAdmin.db();
   * console.log(db.namespace);
   * ```
   *
   * @returns The underlying `Db` object.
   */
  public override db(): Db {
    return this._db;
  }

  /**
   * Lists the namespaces in the database.
   *
   * The first element in the returned array is the default namespace of the database, and the rest are additional
   * namespaces in no particular order.
   *
   * @example
   * ```typescript
   * const namespaces = await dbAdmin.listNamespaces();
   *
   * // ['default_keyspace', 'my_other_keyspace']
   * console.log(namespaces);
   * ```
   *
   * @returns A promise that resolves to list of all the namespaces in the database.
   */
  public override async listNamespaces(options?: WithTimeout): Promise<string[]> {
    const resp = await this._httpClient.executeCommand({ findNamespaces: {} }, { maxTimeMS: options?.maxTimeMS });
    return resp.status!.namespaces;
  }

  /**
   * Creates a new, additional, namespace (aka keyspace) for this database.
   *
   * **NB. The operation will always wait for the operation to complete, regardless of the {@link AdminBlockingOptions}. Expect it to take roughly 8-10 seconds.**
   *
   * @example
   * ```typescript
   * await dbAdmin.createNamespace('my_namespace');
   *
   * await dbAdmin.createNamespace('my_namespace', {
   *   replication: {
   *     class: 'SimpleStrategy',
   *     replicatonFactor: 3,
   *   },
   * });
   *
   * await dbAdmin.createNamespace('my_namespace', {
   *   replication: {
   *     class: 'NetworkTopologyStrategy',
   *     datacenter1: 3,
   *     datacenter2: 2,
   *   },
   * });
   * ```
   *
   * @param namespace - The name of the new namespace.
   * @param options - The options for the timeout & replication behavior of the operation.
   *
   * @returns A promise that resolves when the operation completes.
   */
  public override async createNamespace(namespace: string, options?: LocalCreateNamespaceOptions): Promise<void> {
    const replication = options?.replication ?? {
      class: 'SimpleStrategy',
      replicationFactor: 1,
    };

    await this._httpClient.executeCommand({ createNamespace: { name: namespace, options: { replication } } }, { maxTimeMS: options?.maxTimeMS });

    if (options?.updateDbNamespace) {
      this._db.useNamespace(namespace);
    }
  }

  /**
   * Drops a namespace (aka keyspace) from this database.
   *
   * **NB. The operation will always wait for the operation to complete, regardless of the {@link AdminBlockingOptions}. Expect it to take roughly 8-10 seconds.**
   *
   * @example
   * ```typescript
   * // ['default_keyspace', 'my_other_keyspace']
   * console.log(await dbAdmin.listNamespaces());
   *
   * await dbAdmin.dropNamespace('my_other_keyspace');
   *
   * // ['default_keyspace', 'my_other_keyspace']
   * console.log(await dbAdmin.listNamespaces());
   * ```
   *
   * @param namespace - The name of the namespace to drop.
   * @param options - The options for the timeout of the operation.
   *
   * @returns A promise that resolves when the operation completes.
   */
  public override async dropNamespace(namespace: string, options?: AdminBlockingOptions): Promise<void> {
    await this._httpClient.executeCommand({ dropNamespace: { name: namespace } }, { maxTimeMS: options?.maxTimeMS });
  }
}
