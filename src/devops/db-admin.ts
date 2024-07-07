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

import { AdminBlockingOptions, CreateNamespaceOptions } from '@/src/devops/types';
import { Db } from '@/src/data-api';

/**
 * Represents some DatabaseAdmin class used for managing some specific database.
 *
 * This abstract version lists the core functionalities that any database admin class may have, but
 * subclasses may have additional methods or properties (e.g. {@link AstraDbAdmin}).
 *
 * Use {@link Db.admin} or {@link AstraAdmin.dbAdmin} to obtain an instance of this class.
 *
 * @public
 */
export abstract class DbAdmin {
  /**
   * Gets the underlying `Db` object. The options for the db were set when the DbAdmin instance, or whatever spawned
   * it, was created.
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
  abstract db(): Db;
  /**
   * Retrieves a list of all the namespaces in the database.
   *
   * Semantic order is not guaranteed, but implementations are free to assign one. {@link AstraDbAdmin}, for example,
   * always has the first keyspace in the array be the default one.
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
  abstract listNamespaces(): Promise<string[]>;
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
  abstract createNamespace(namespace: string, options?: CreateNamespaceOptions): Promise<void>;
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
  abstract dropNamespace(namespace: string, options?: AdminBlockingOptions): Promise<void>;
}
