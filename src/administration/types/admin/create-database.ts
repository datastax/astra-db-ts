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

import type { AstraAdminBlockingOptions, AstraDatabaseCloudProvider } from '@/src/administration/types/index.js';


import type { DbOptions } from '@/src/client/index.js';
import type { CommandOptions } from '@/src/lib/index.js';

/**
 * ##### Overview
 *
 * Represents the core definition options for creating a new vector-enabled DataStax Astra database.
 *
 * This includes required settings such as the database name, cloud provider, and region, as well as an optionally specified keyspace.
 *
 * Note that:
 * - If no `keyspace` is provided, Astra will automatically provide a keyspace named `default_keyspace`.
 * - Available regions may vary depending on the selected cloud provider.
 * - It is **not possible** to create a non-vector database through the Data API clients.
 *
 * **Disclaimer: database creation is a lengthy operation, and may take upwards of 2-3 minutes**
 *
 * ---
 *
 * ##### Example
 *
 * These options are used in the first parameter of the `createDatabase` method.
 *
 * @example
 * ```ts
 * const dbAdmin = await admin.createDatabase({
 *   name: 'my-db',
 *   cloudProvider: 'GCP',
 *   region: 'us-central1',
 * });
 * ```
 *
 * @see AstraAdmin.createDatabase
 * @see CreateAstraDatabaseOptions
 *
 * @public
 */
export interface AstraDatabaseConfig {
  /**
   * A user-defined name for the database, e.g. `my_database`.
   */
  name: string,
  /**
   * The cloud provider where the database will be hosted.
   *
   * Supported values include `'AWS'`, `'GCP'`, and `'AZURE'`.
   *
   * **Note: available regions vary across providers.**
   */
  cloudProvider: AstraDatabaseCloudProvider,
  /**
   * The specific cloud region in which the database will be deployed, e.g. `us-east1`.
   *
   * **Note: the region must be valid for the selected `cloudProvider`.**
   */
  region: string,
  /**
   * The default keyspace to create within the database, e.g. `my_keyspace`.
   *
   * If omitted, Astra will automatically provide a keyspace named `default_keyspace`.
   */
  keyspace?: string,
  /**
   * The PCU group to attach the database to once it is created.
   */
  pcuGroupUUID?: string,
}

/**
 * ##### Overview
 *
 * Represents the client-side options for creating a new vector-enabled DataStax Astra database.
 *
 * These options include the blocking options, the timeout, and any custom options for the {@link Db} instance underlying the {@link AstraDbAdmin} that is returned once the database is created.
 *
 * **Disclaimer: database creation is a lengthy operation, and may take upwards of 2-3 minutes**
 *
 * ---
 *
 * ##### Example
 *
 * These options are used in the second parameter of the `createDatabase` method.
 *
 * @example
 * ```ts
 * const dbAdmin = await admin.createDatabase({
 *   name: 'my-db',
 *   cloudProvider: 'GCP',
 *   region: 'us-central1',
 * }, {
 *   databaseAdminTimeoutMs: 240000,
 *   pollInterval: 20000,
 *   dbOptions: { logging: 'all' },
 * });
 * ```
 *
 * @see AstraAdmin.createDatabase
 * @see AstraDatabaseConfig
 *
 * @public
 */
export type CreateAstraDatabaseOptions = AstraAdminBlockingOptions & CommandOptions<{ timeout: 'databaseAdminTimeoutMs' }> & {
  /**
   * Optional overrides for the {@link Db} instance underlying the {@link AstraDbAdmin} that is returned once the database is created.
   *
   * The {@link AdminOptions} for the spawned {@link AstraDbAdmin} are simply copied from the {@link AstraAdmin} instance performing the operation.
   */
  dbOptions?: DbOptions,
}
