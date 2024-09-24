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

import { AdminBlockingOptions, CreateKeyspaceOptions, CreateNamespaceOptions } from '@/src/administration/types';
import { FindEmbeddingProvidersResult } from '@/src/administration/types/db-admin/find-embedding-providers';
import { WithTimeout } from '@/src/lib';
import { Db } from '@/src/db';

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
   *   keyspace: 'my-keyspace',
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
  abstract findEmbeddingProviders(options?: WithTimeout): Promise<FindEmbeddingProvidersResult>;
  /**
   * Retrieves a list of all the keyspaces in the database.
   *
   * Semantic order is not guaranteed, but implementations are free to assign one. {@link AstraDbAdmin}, for example,
   * always has the first keyspace in the array be the default one.
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
  abstract listKeyspaces(): Promise<string[]>;
  /**
   * Retrieves a list of all the keyspaces in the database.
   *
   * Creates a new, additional, keyspace for this database.
   *
   * This is now a deprecated alias for the strictly equivalent {@link DbAdmin.listKeyspaces}, and will be removed
   * in an upcoming major version.
   *
   * @deprecated - Prefer {@link DbAdmin.listKeyspaces} instead.
   */
  abstract listNamespaces(): Promise<string[]>;
  /**
   * Creates a new, additional, keyspace for this database.
   *
   * **NB. this is a "long-running" operation. See {@link AdminBlockingOptions} about such blocking operations.** The
   * default polling interval is 1 second. Expect it to take roughly 8-10 seconds to complete.
   *
   * @example
   * ```typescript
   * await dbAdmin.createKeyspace('my_other_keyspace1');
   *
   * // ['default_keyspace', 'my_other_keyspace1']
   * console.log(await dbAdmin.listKeyspaces());
   *
   * await dbAdmin.createKeyspace('my_other_keyspace2', {
   *   blocking: false,
   * });
   *
   * // Will not include 'my_other_keyspace2' until the operation completes
   * console.log(await dbAdmin.listKeyspaces());
   * ```
   *
   * @remarks
   * Note that if you choose not to block, the created keyspace will not be able to be used until the
   * operation completes, which is up to the caller to determine.
   *
   * @param keyspace - The name of the new keyspace.
   * @param options - The options for the blocking behavior of the operation.
   *
   * @returns A promise that resolves when the operation completes.
   */
  abstract createKeyspace(keyspace: string, options?: CreateKeyspaceOptions): Promise<void>;
  /**
   * Creates a new, additional, keyspace for this database.
   *
   * This is now a deprecated alias for the strictly equivalent {@link DbAdmin.createKeyspace}, and will be removed
   * in an upcoming major version.
   *
   * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
   *
   * @deprecated - Prefer {@link DbAdmin.createKeyspace} instead.
   */
  abstract createNamespace(keyspace: string, options?: CreateNamespaceOptions): Promise<void>;
  /**
   * Drops a keyspace from this database.
   *
   * **NB. this is a "long-running" operation. See {@link AdminBlockingOptions} about such blocking operations.** The
   * default polling interval is 1 second. Expect it to take roughly 8-10 seconds to complete.
   *
   * @example
   * ```typescript
   * await dbAdmin.dropKeyspace('my_other_keyspace1');
   *
   * // ['default_keyspace', 'my_other_keyspace2']
   * console.log(await dbAdmin.listKeyspaces());
   *
   * await dbAdmin.dropKeyspace('my_other_keyspace2', {
   *   blocking: false,
   * });
   *
   * // Will still include 'my_other_keyspace2' until the operation completes
   * // ['default_keyspace', 'my_other_keyspace2']
   * console.log(await dbAdmin.listKeyspaces());
   * ```
   *
   * @remarks
   * Note that if you choose not to block, the keyspace will still be able to be used until the operation
   * completes, which is up to the caller to determine.
   *
   * @param keyspace - The name of the keyspace to drop.
   * @param options - The options for the blocking behavior of the operation.
   *
   * @returns A promise that resolves when the operation completes.
   */
  abstract dropKeyspace(keyspace: string, options?: AdminBlockingOptions): Promise<void>;
  /**
   * Drops a keyspace from this database.
   *
   * This is now a deprecated alias for the strictly equivalent {@link DbAdmin.dropKeyspace}, and will be removed
   * in an upcoming major version.
   *
   * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
   *
   * @deprecated - Prefer {@link DbAdmin.dropKeyspace} instead.
   */
  abstract dropNamespace(keyspace: string, options?: AdminBlockingOptions): Promise<void>;
}
