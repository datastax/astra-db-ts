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

/**
 * An administrative class for managing Astra databases, including creating, listing, and deleting databases.
 *
 * **Shouldn't be instantiated directly; use {@link DataAPIClient.admin} to obtain an instance of this class.**
 *
 * To perform admin tasks on a per-database basis, see the {@link AstraDbAdmin} class.
 *
 * @example
 * ```typescript
 * const client = new DataAPIClient('token');
 *
 * // Create an admin instance with the default token
 * const admin1 = client.admin();
 *
 * // Create an admin instance with a custom token
 * const admin2 = client.admin({ adminToken: 'stronger-token' });
 *
 * const dbs = await admin1.listDatabases();
 * console.log(dbs);
 * ```
 *
 * @see DataAPIClient.admin
 * @see AstraDbAdmin
 *
 * @public
 */
export class DataAPIDbAdmin extends DbAdmin {
  private readonly _httpClient!: DataAPIHttpClient;
  private readonly _db!: Db;

  /**
   * Use {@link Db.admin} or {@link AstraAdmin.dbAdmin} to obtain an instance of this class.
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
   * Gets the ID of the Astra DB instance this object is managing.
   *
   * @returns The ID of the Astra DB instance.
   */
  public get id(): string {
    return this._db.id;
  }

  /**
   * Gets the underlying `Db` object. The options for the db were set when the AstraDbAdmin instance, or whatever
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
   * console.log(db.id);
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
   * **NB. this is a "long-running" operation. See {@link AdminBlockingOptions} about such blocking operations.** The
   * default polling interval is 1 second. Expect it to take roughly 8-10 seconds to complete.
   *
   * @example
   * ```typescript
   * await dbAdmin.createNamespace('my_other_keyspace1');
   *
   * // ['default_keyspace', 'my_other_keyspace1']
   * console.log(await dbAdmin.listNamespaces());
   *
   * await dbAdmin.createNamespace('my_other_keyspace2', {
   *   blocking: false,
   * });
   *
   * // Will not include 'my_other_keyspace2' until the operation completes
   * console.log(await dbAdmin.listNamespaces());
   * ```
   *
   * @remarks
   * Note that if you choose not to block, the created namespace will not be able to be used until the
   * operation completes, which is up to the caller to determine.
   *
   * @param namespace - The name of the new namespace.
   * @param options - The options for the blocking behavior of the operation.
   *
   * @returns A promise that resolves when the operation completes.
   */
  public override async createNamespace(namespace: string, options?: AdminBlockingOptions): Promise<void> {
    await this._httpClient.executeCommand({ createNamespace: { name: namespace } }, { maxTimeMS: options?.maxTimeMS });
  }

  /**
   * Drops a namespace (aka keyspace) from this database.
   *
   * **NB. this is a "long-running" operation. See {@link AdminBlockingOptions} about such blocking operations.** The
   * default polling interval is 1 second. Expect it to take roughly 8-10 seconds to complete.
   *
   * @example
   * ```typescript
   * await dbAdmin.dropNamespace('my_other_keyspace1');
   *
   * // ['default_keyspace', 'my_other_keyspace2']
   * console.log(await dbAdmin.listNamespaces());
   *
   * await dbAdmin.dropNamespace('my_other_keyspace2', {
   *   blocking: false,
   * });
   *
   * // Will still include 'my_other_keyspace2' until the operation completes
   * // ['default_keyspace', 'my_other_keyspace2']
   * console.log(await dbAdmin.listNamespaces());
   * ```
   *
   * @remarks
   * Note that if you choose not to block, the namespace will still be able to be used until the operation
   * completes, which is up to the caller to determine.
   *
   * @param namespace - The name of the namespace to drop.
   * @param options - The options for the blocking behavior of the operation.
   *
   * @returns A promise that resolves when the operation completes.
   */
  public override async dropNamespace(namespace: string, options?: AdminBlockingOptions): Promise<void> {
    await this._httpClient.executeCommand({ dropNamespace: { name: namespace } }, { maxTimeMS: options?.maxTimeMS });
  }
}
