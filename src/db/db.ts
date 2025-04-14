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

import type { FoundDoc, SomeDoc, WithId } from '@/src/documents/collections/index.js';
import { Collection } from '@/src/documents/collections/index.js';
import type { RawDataAPIResponse, WithTimeout } from '@/src/lib/api/index.js';
import { DEFAULT_KEYSPACE, type OpaqueHttpClient } from '@/src/lib/api/index.js';
import { AstraDbAdmin } from '@/src/administration/astra-db-admin.js';
import type { DataAPIEnvironment } from '@/src/lib/types.js';
import { extractDbComponentsFromAstraUrl } from '@/src/documents/utils.js';
import type { DbAdmin } from '@/src/administration/index.js';
import { DataAPIDbAdmin } from '@/src/administration/data-api-db-admin.js';
import type { CreateCollectionOptions } from '@/src/db/types/collections/create.js';
import { DataAPIHttpClient, EmissionStrategy } from '@/src/lib/api/clients/data-api-http-client.js';
import type { KeyspaceRef } from '@/src/lib/api/clients/types.js';
import type { CommandEventMap, FoundRow, SomePKey, SomeRow, TableDropIndexOptions } from '@/src/documents/index.js';
import { Table } from '@/src/documents/index.js';
import { DEFAULT_DATA_API_PATHS } from '@/src/lib/api/constants.js';
import type { CollectionOptions } from '@/src/db/types/collections/spawn.js';
import type { DropCollectionOptions } from '@/src/db/types/collections/drop.js';
import type { CollectionDescriptor, ListCollectionsOptions } from '@/src/db/types/collections/list.js';
import type { RunCommandOptions } from '@/src/db/types/command.js';
import type { TableOptions } from '@/src/db/types/tables/spawn.js';
import type { CreateTableDefinition, CreateTableOptions } from '@/src/db/types/tables/create.js';
import type { InferTablePrimaryKey, InferTableSchema } from '@/src/db/types/tables/infer.js';
import type { DropTableOptions } from '@/src/db/types/tables/drop.js';
import type { ListTablesOptions, TableDescriptor } from '@/src/db/types/tables/list-tables.js';
import type { AdminOptions } from '@/src/client/types/index.js';
import { $CustomInspect } from '@/src/lib/constants.js';
import { InvalidEnvironmentError } from '@/src/db/errors.js';
import type { AstraPartialDatabaseInfo } from '@/src/administration/types/admin/database-info.js';
import { CollSerDes } from '@/src/documents/collections/ser-des/ser-des.js';
import { TableSerDes } from '@/src/documents/tables/ser-des/ser-des.js';
import { AdminOptsHandler } from '@/src/client/opts-handlers/admin-opts-handler.js';
import type { ParsedDbOptions } from '@/src/client/opts-handlers/db-opts-handler.js';
import { DbOptsHandler } from '@/src/client/opts-handlers/db-opts-handler.js';
import type { ParsedRootClientOpts } from '@/src/client/opts-handlers/root-opts-handler.js';
import { EnvironmentCfgHandler } from '@/src/client/opts-handlers/environment-cfg-handler.js';
import { HierarchicalLogger, TokenProvider } from '@/src/lib/index.js';

/**
 * ##### Overview
 *
 * Represents an interface to some Data-API-enabled database instance. This is the entrypoint for database-level DML, such as
 * creating/deleting collections/tables, connecting to collections/tables, and executing arbitrary commands.
 *
 * > **⚠️Warning**: This shouldn't be instantiated directly; use {@link DataAPIClient.db} to spawn this class.
 *
 * Note that creating an instance of a `Db` doesn't trigger actual database creation; the database must have already
 * existed beforehand. If you need to create a new database, use the {@link AstraAdmin} class.
 *
 * @example
 * ```ts
 * // Connect to a database using a direct endpoint
 * const db = client.db('*ENDPOINT*');
 *
 * // Overrides default options from the DataAPIClient
 * const db = client.db('*ENDPOINT*', {
 *   keyspace: '*KEYSPACE*',
 *   token: '*TOKEN*',
 * });
 * ```
 *
 * ---
 *
 * ##### The "working keyspace"
 *
 * The `Db` class has a concept of a "working keyspace", which is the default keyspace used for all operations in the database. This can be overridden in each method call, but if not, the default keyspace is used.
 *
 * If no explicit keyspace is provided when creating the `Db` instance, it will default to:
 * - On DataStax Astra: `'default_keyspace'`
 * - On all other dbs, it will remain as `undefined`
 *   - In this case, the keyspace must be set using either:
 *     - The `db.useKeyspace()` mutator method
 *     - The `updateDbKeyspace` parameter in `dbAdmin.createKeyspace()`
 *
 * Changing the working namespaces does _NOT_ retroactively update any collections/tables spawned from this `Db` instance.
 *
 * See {@link Db.keyspace}, {@link Db.useKeyspace} and {@link DbAdmin.createKeyspace} for more information.
 *
 * @example
 * ```ts
 * // Method 1:
 * db.useKeyspace('my_keyspace');
 *
 * // Method 2:
 * // (If using non-astra, this may be a common idiom)
 * await db.admin().createKeyspace('my_keyspace', {
 *   updateDbKeyspace: true,
 * });
 * ```
 *
 * ---
 *
 * ##### Astra vs. non-Astra
 *
 * The `Db` class is designed to work with both Astra and non-Astra databases. However, there are some differences in behavior between the two:
 * - Astra DBs have an ID & region, which can be accessed using `db.id` and `db.region` respectively
 *   - Note that this is not available with Astra private endpoints
 * - Astra DBs have a `db.info()` method, which provides detailed information about the database
 *   - Note that this is not available with Astra private endpoints
 * - The `db.admin()` method will return differently depending on the environment
 *   - For Astra DBs, it will return an {@link AstraDbAdmin} instance
 *   - For non-Astra DBs, it will return a {@link DataAPIDbAdmin} instance
 *   - (The `environment` option must also be set in the `admin()` method)
 * - As aforementioned, the default keyspace is different between Astra and non-Astra databases
 *   - See the previous section for more information
 *
 * @see DataAPIClient.db
 * @see AstraAdmin.db
 * @see Table
 * @see Collection
 * @see DbAdmin
 *
 * @public
 */
export class Db extends HierarchicalLogger<CommandEventMap> {
  readonly #defaultOpts: ParsedRootClientOpts;
  readonly #httpClient: DataAPIHttpClient;

  readonly #keyspace: KeyspaceRef;
  readonly #id?: string;
  readonly #region?: string;

  /**
   * ##### Overview
   *
   * The endpoint of the database.
   *
   * This will be verbatim with the endpoint that was passed to `client.db()`, except any trailing slashes will be stripped.
   *
   * @example
   * ```ts
   * const db = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
   * db.endpoint; // 'https://<db_id>-<region>.apps.astra.datastax.com'
   * ```
   */
  public readonly endpoint!: string;

  /**
   * Use {@link DataAPIClient.db} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(rootOpts: ParsedRootClientOpts, endpoint: string, dbOpts: ParsedDbOptions) {
    const defaultOpts = {
      ...rootOpts,
      dbOptions: DbOptsHandler.concat([rootOpts.dbOptions, dbOpts]),
      adminOptions: AdminOptsHandler.concatParse([rootOpts.adminOptions], {
        adminToken: TokenProvider.opts.parseWithin(dbOpts, 'token'),
      }),
    };

    super(rootOpts.client, defaultOpts.dbOptions.logging);

    this.#defaultOpts = defaultOpts;

    this.#keyspace = {
      ref: (rootOpts.environment === 'astra')
        ? this.#defaultOpts.dbOptions.keyspace ?? DEFAULT_KEYSPACE
        : this.#defaultOpts.dbOptions.keyspace ?? undefined,
    };

    endpoint = (endpoint.endsWith('/'))
      ? endpoint.replace(/\/+$/, "")
      : endpoint;

    this.#httpClient = new DataAPIHttpClient({
      baseUrl: endpoint,
      tokenProvider: this.#defaultOpts.dbOptions.token,
      baseApiPath: this.#defaultOpts.dbOptions.dataApiPath || DEFAULT_DATA_API_PATHS[rootOpts.environment],
      logger: this,
      fetchCtx: rootOpts.fetchCtx,
      keyspace: this.#keyspace,
      caller: rootOpts.caller,
      emissionStrategy: EmissionStrategy.Normal,
      additionalHeaders: this.#defaultOpts.additionalHeaders,
      timeoutDefaults: this.#defaultOpts.dbOptions.timeoutDefaults,
    });

    [this.#id, this.#region] = extractDbComponentsFromAstraUrl(endpoint);

    Object.defineProperty(this, 'endpoint', {
      value: endpoint,
    });

    Object.defineProperty(this, $CustomInspect, {
      value: () => `Db(endpoint="${this.endpoint}",keyspace="${this.keyspace}")`,
    });
  }

  /**
   * ##### Overview
   *
   * The "working keyspace" used for all operations in this {@link Db} instance (unless overridden in a method call).
   *
   * See the {@link Db} class documentation for more information about the working keyspace.
   *
   * ##### Common examples
   *
   * See the following sections for examples specific to Astra & non-Astra (DSE, HCE, etc.) databases.
   *
   * @example
   * ```ts
   * // Uses 'my_keyspace' as the default keyspace for all future db spawns
   * const client = new DataAPIClient('*TOKEN*', {
   *   dbOptions: { keyspace: 'my_keyspace' },
   * });
   * client.db(...).keyspace // 'my_keyspace'
   * ```
   *
   * @example
   * ```ts
   * // Uses 'my_keyspace' for this specific db spawn
   * const client = new DataAPIClient('*TOKEN*');
   * client.db(..., { keyspace: 'my_keyspace' }).keyspace // 'default_keyspace'
   * ```
   *
   * ##### On Astra
   *
   * Note that on Astra databases, this will default to `default_keyspace` if not set explicitly.
   *
   * @example
   * ```ts
   * // Uses 'default_keyspace' as the default keyspace for all future db spawns
   * const client = new DataAPIClient('*TOKEN*');
   * client.db(...).keyspace // 'default_keyspace'
   * ```
   *
   * ---
   *
   * ##### On non-Astra (DSE, HCD, etc.)
   *
   * On non-Astra databases, this will be `undefined` if not set explicitly, as HCD, DSE, etc. are not guaranteed to have a default `default_keyspace`.
   *
   * You will need to either set the `keyspace` parameter somewhere, or update the {@link Db} instance's keyspace via either
   * - {@link Db.useKeyspace}
   * - The `updateDbKeyspace` parameter in {@link DbAdmin.createKeyspace}
   *
   * @example
   * ```ts
   * // No default keyspace on db spawns
   * const client = new DataAPIClient('*TOKEN*');
   * client.db(...).keyspace // undefined
   * ```
   *
   * @example
   * ```ts
   * // A potentially common idiom for non-Astra
   * const client = new DataAPIClient('*TOKEN*');
   *
   * const db = client.db(...);
   * db.keyspace // undefined
   *
   * await db.admin().createKeyspace('my_keyspace', {
   *   updateDbKeyspace: true,
   * });
   * db.keyspace // 'my_keyspace'
   * ```
   */
  public get keyspace(): string {
    if (!this.#keyspace.ref) {
      throw new Error('No keyspace set for DB (can\'t do db.keyspace, or perform any operation requiring it). Use `db.useKeyspace`, or pass the keyspace as an option parameter explicitly.');
    }
    return this.#keyspace.ref;
  }

  /**
   * ##### Overview
   *
   * The ID of the database (a UUID), if it's an Astra database.
   *
   * > **⚠️Warning**: This only works for Astra databases, which are not connected to via a private endpoint.
   *
   * @example
   * ```ts
   * const db = client.db('https://<db_id>-<region>.apps.astra-dev.datastax.com');
   * db.id; // '<db_id>'
   * ```
   *
   * @throws InvalidEnvironmentError - if the database is not an Astra database.
   */
  public get id(): string {
    if (this.#defaultOpts.environment !== 'astra') {
      throw new InvalidEnvironmentError('db.id', this.#defaultOpts.environment, ['astra'], 'non-Astra databases have no appropriate ID');
    }
    if (!this.#id) {
      throw new Error(`Unexpected AstraDB endpoint URL '${this.endpoint}'—database ID unable to be parsed`);
    }
    return this.#id;
  }

  /**
   * The region of the database (e.g. `'us-east-1'`), if it's an Astra database.
   *
   * > **⚠️Warning**: This only works for Astra databases, which are not connected to via a private endpoint.
   *
   * @example
   * ```ts
   * const db = client.db('https://<db_id>-<region>.apps.astra-dev.datastax.com');
   * db.region; // '<region>'
   * ```
   *
   * @throws InvalidEnvironmentError - if the database is not an Astra database.
   */
  public get region(): string {
    if (this.#defaultOpts.environment !== 'astra') {
      throw new InvalidEnvironmentError('db.region', this.#defaultOpts.environment, ['astra'], 'non-Astra databases have no appropriate region');
    }
    if (!this.#region) {
      throw new Error(`Unexpected AstraDB endpoint URL '${this.endpoint}'—database region unable to be parsed`);
    }
    return this.#region;
  }

  /**
   * ##### Overview
   *
   * Sets the default working keyspace of the `Db` instance. Does not retroactively update any previous collections
   * spawned from this `Db` to use the new keyspace.
   *
   * See {@link Db} for more info on "working keyspaces".
   *
   * @example
   * ```typescript
   * // Spawns a `Db` with default working keyspace `my_keyspace`
   * const db = client.db('<endpoint>', { keyspace: 'my_keyspace' });
   *
   * // Gets a collection from keyspace `my_keyspace`
   * const coll1 = db.collection('my_coll');
   *
   * // `db` now uses `my_other_keyspace` as the default keyspace for all operations
   * db.useKeyspace('my_other_keyspace');
   *
   * // Gets a collection from keyspace `my_other_keyspace`
   * // `coll1` still uses keyspace `my_keyspace`
   * const coll2 = db.collection('my_other_coll');
   *
   * // Gets `my_coll` from keyspace `my_keyspace` again
   * // (The default keyspace is still `my_other_keyspace`)
   * const coll3 = db.collection('my_coll', { keyspace: 'my_keyspace' });
   * ```
   *
   * ---
   *
   * ##### `updateDbKeyspace` in `DbAdmin.createKeyspace`
   *
   * If you want to create a `Db` in a not-yet-existing keyspace, you can use the `updateDbKeyspace` option in {@link DbAdmin.createKeyspace} to set the default keyspace of the `Db` instance to the new keyspace.
   *
   * This may be a common idiom when working with non-Astra databases.
   *
   * @example
   * ```typescript
   * const client = new DataAPIClient({ environment: 'dse' });
   * const db = client.db('<endpoint>', { token: '<token>' });
   *
   * // Will internally call `db.useKeyspace('new_keyspace')`
   * await db.admin().createKeyspace('new_keyspace', {
   *   updateDbKeyspace: true,
   * });
   *
   * // Creates collection in keyspace `new_keyspace` by default now
   * const coll = db.createCollection('my_coll');
   * ```
   *
   * @param keyspace - The keyspace to use
   */
  public useKeyspace(keyspace: string) {
    this.#keyspace.ref = keyspace;
  }

  /**
   * ##### Overview (Astra overload)
   *
   * Spawns a new {@link AstraDbAdmin} instance for this database, used for performing administrative operations
   * on the database, such as managing keyspaces, or getting database information.
   *
   * The given options will override any default options set when creating the {@link DataAPIClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
   *
   * @example
   * ```typescript
   * const admin1 = db.admin();
   * const admin2 = db.admin({ adminToken: '<stronger-token>' });
   *
   * const keyspaces = await admin1.listKeyspaces();
   * console.log(keyspaces);
   * ```
   *
   * ---
   *
   * ##### Astra vs. non-Astra
   *
   * > **⚠️Warning**: If using a non-Astra backend, the `environment` option **must** be set as it is on the `DataAPIClient`.
   *
   * If on Astra, this method will return a new {@link AstraDbAdmin} instance, which provides a few extra methods for Astra databases, such as {@link AstraDbAdmin.info} or {@link AstraDbAdmin.drop}.
   *
   * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
   *
   * @returns A new {@link AstraDbAdmin} instance for this database instance.
   *
   * @throws InvalidEnvironmentError - if the database is not an Astra database.
   */
  public admin(options?: AdminOptions & { environment?: 'astra' }): AstraDbAdmin

  /**
   * ##### Overview (Non-Astra overload)
   *
   * Spawns a new {@link DataAPIDbAdmin} instance for this database, used for performing administrative operations
   * on the database, such as managing keyspaces, or getting database information.
   *
   * The given options will override any default options set when creating the {@link DataAPIClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
   *
   * @example
   * ```typescript
   * const client = new DataAPIClient({ environment: 'dse' });
   * const db = client.db('*ENDPOINT*', { token });
   *
   * // OK
   * const admin1 = db.admin({ environment: 'dse' });
   *
   * // Will throw "mismatching environments" error
   * const admin2 = db.admin();
   *
   * const keyspaces = await admin1.listKeyspaces();
   * console.log(keyspaces);
   * ```
   *
   * ---
   *
   * ##### Astra vs. non-Astra
   *
   * > **⚠️Warning**: If using a non-Astra backend, the `environment` option **must** be set as it is on the `DataAPIClient`.
   *
   * If on non-Astra, this method will return a new {@link DataAPIDbAdmin} instance, which conforms strictly to the {@link DbAdmin} interface, with the {@link DataAPIDbAdmin.createKeyspace} method being the only method that differs slightly from the interface version.
   *
   * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
   *
   * @returns A new {@link AstraDbAdmin} instance for this database instance.
   *
   * @throws InvalidEnvironmentError - if the database is an Astra database.
   */
  public admin(options: AdminOptions & { environment: Exclude<DataAPIEnvironment, 'astra'> }): DataAPIDbAdmin

  public admin(options?: AdminOptions & { environment?: DataAPIEnvironment }): DbAdmin {
    const environment = EnvironmentCfgHandler.parseWithin(options, 'options.environment');
    const parsedOpts = AdminOptsHandler.parse(options, 'options');

    if (this.#defaultOpts.environment !== environment) {
      throw new InvalidEnvironmentError('db.admin()', environment, [this.#defaultOpts.environment], 'environment option is not the same as set in the DataAPIClient');
    }

    if (environment === 'astra') {
      return new AstraDbAdmin(this, this.#defaultOpts, parsedOpts, this.#defaultOpts.dbOptions.token, this.endpoint);
    }

    if (extractDbComponentsFromAstraUrl(this.endpoint).length !== 0) {
      throw new InvalidEnvironmentError('db.admin()', environment, [this.#defaultOpts.environment], 'environment option must be "astra" or unset for this database');
    }

    return new DataAPIDbAdmin(this, this.#defaultOpts.client, this.#httpClient, this.#defaultOpts, parsedOpts);
  }

  /**
   * ##### Overview
   *
   * Fetches information about the database, such as the database name, region, and other metadata.
   *
   * > **⚠️Warning**: This only works for Astra databases, which are not connected to via a private endpoint.
   *
   * > **✏️Note**: For the full, complete, information, use {@link AstraDbAdmin.info} or {@link AstraAdmin.dbInfo} instead.
   *
   * The method issues a request to the DevOps API each time it is invoked, without caching mechanisms;
   * this ensures up-to-date information for usages such as real-time collection validation by the application.
   *
   * @example
   * ```typescript
   * const info = await db.info();
   * console.log(info.name);
   * ```
   *
   * ---
   *
   * ##### On non-Astra
   *
   * This operation requires a call to the DevOps API, which is only available on Astra databases. As such, this method will throw an error if the database is not an Astra database.
   *
   * @returns A promise that resolves to the database information.
   *
   * @throws Error - if the database is not an Astra database.
   */
  public async info(options?: WithTimeout<'databaseAdminTimeoutMs'>): Promise<AstraPartialDatabaseInfo> {
    if (this.#defaultOpts.environment !== 'astra') {
      throw new InvalidEnvironmentError('db.info()', this.#defaultOpts.environment, ['astra'], 'info() is only available for Astra databases');
    }

    const data = await this.admin().info(options);

    const region = this.endpoint
      .split('.')[0]
      .split('https://')[1]
      .split('-')
      .slice(5)
      .join('-');

    return {
      id: data.id,
      name: data.name,
      keyspaces: data.keyspaces,
      status: data.status,
      environment: data.environment,
      cloudProvider: data.cloudProvider,
      region: region,
      apiEndpoint: this.endpoint,
      raw: data.raw.info,
    };
  }

  /**
   * ##### Overview
   *
   * Establishes a reference to a collection in the database. This method does not perform any I/O.
   *
   * > **⚠️Warning**: This method does _not_ verify the existence of the collection; it simply creates a reference.
   *
   * @example
   * ```ts
   * interface User {
   *   name: string,
   *   age?: number,
   * }
   *
   * // Basic usage
   * const users1 = db.collection<User>('users');
   * users1.insertOne({ name: 'John' });
   *
   * // Untyped collection from different keyspace
   * const users2 = db.collection('users', {
   *   keyspace: 'my_keyspace',
   * });
   * users2.insertOne({ 'anything[you]$want': 'John' }); // Dangerous
   * ```
   *
   * ---
   *
   * ##### No I/O
   *
   * > **🚨Important**: Unlike the MongoDB Node.js driver, this method does not create a collection if it doesn't exist.
   * >
   * > Use {@link Db.createCollection} to create a new collection instead.
   *
   * It is on the user to ensure that the collection being connected to actually exists.
   *
   * ---
   *
   * ##### Typing the collection, and much more information
   *
   * See the {@link Collection} class's documentation for information on how and why the {@link Collection} class is typed, any disclaimers related to it, and for so much more information in general.
   *
   * > **⚠️Warning:** Collections are _inherently untyped_; any typing is client-side to help with bug-catching.
   *
   * @param name - The name of the collection.
   * @param options - Options for spawning the collection.
   *
   * @returns A new, unvalidated, reference to the collection.
   *
   * @see SomeDoc
   * @see VectorDoc
   * @see VectorizeDoc
   * @see db.createCollection
   */
  public collection<WSchema extends SomeDoc, RSchema extends WithId<SomeDoc> = FoundDoc<WSchema>>(name: string, options?: CollectionOptions): Collection<WSchema, RSchema> {
    return new Collection(this, this.#httpClient, name, this.#defaultOpts, {
      ...options,
      serdes: CollSerDes.cfg.concatParse([this.#defaultOpts.dbOptions.collSerdes], options?.serdes),
    });
  }

  /**
   * ##### Overview
   *
   * Establishes a reference to a table in the database. This method does not perform any I/O.
   *
   * > **⚠️Warning**: This method does _not_ verify the existence of the table; it simply creates a reference.
   *
   * @example
   * ```ts
   * interface User {
   *   name: string,
   *   age?: number,
   * }
   *
   * // Basic usage
   * const users1 = db.table<User>('users');
   * users1.insertOne({ name: 'John' });
   *
   * // Untyped table from different keyspace
   * const users2 = db.table('users', {
   *   keyspace: 'my_keyspace',
   * });
   * users2.insertOne({ 'anything[you]$want': 'John' }); // Dangerous
   * ```
   *
   * ---
   *
   * ##### No I/O
   *
   * > **🚨Important**: This method does not create a table if it doesn't exist.
   * >
   * > Use {@link Db.createTable} to create a new table.
   *
   * It is on the user to ensure that the table being connected to actually exists.
   *
   * ---
   *
   * ##### Typing the table, and much more information
   *
   * > **💡Tip:** You can use {@link InferTableSchema} to infer the TS-equivalent-type of the table from the provided `CreateTableDefinition`.
   *
   * See the {@link Table} class's documentation for information on how and why the {@link Table} class is typed, any disclaimers related to it, and for so much more information in general.
   *
   * @param name - The name of the table.
   * @param options - Options for spawning the table.
   *
   * @returns A new, unvalidated, reference to the table.
   *
   * @see SomeRow
   * @see db.createTable
   * @see InferTableSchema
   * @see InferTablePrimaryKey
   */
  public table<WSchema extends SomeRow, PKeys extends SomePKey = Partial<FoundRow<WSchema>>, RSchema extends SomeRow = FoundRow<WSchema>>(name: string, options?: TableOptions): Table<WSchema, PKeys, RSchema> {
    return new Table(this, this.#httpClient, name, this.#defaultOpts, {
      ...options,
      serdes: TableSerDes.cfg.concatParse([this.#defaultOpts.dbOptions.tableSerdes], options?.serdes),
    });
  }

  /**
   * ##### Overview
   *
   * Creates a new collection in the database, and establishes a reference to it.
   *
   * This is a **blocking** command which performs actual I/O (unlike {@link Db.collection}, which simply creates an
   * unvalidated reference to a collection).
   *
   * @example
   * ```ts
   * // Most basic usage
   * const users = await db.createCollection('users');
   *
   * // With custom options in a different keyspace
   * const users2 = await db.createCollection('users', {
   *   keyspace: 'my_keyspace',
   *   defaultId: {
   *     type: 'objectId',
   *   },
   * });
   * ```
   *
   * ---
   *
   * ##### Idempotency
   *
   * Creating a collection is **idempotent** as long as the options remain the same; if the collection already exists with the same options, a {@link DataAPIResponseError} will be thrown.
   *
   * ("options" meaning the `createCollection` options actually sent to the server, not things like `timeout` which are just client-side).
   *
   * ---
   *
   * ##### Enabling vector search
   *
   * *If vector options are not specified, the collection will not support vector search.*
   *
   * You can enable it by providing a `vector` option with the desired configuration, optionally with a `vector.service` block to enable vectorize (auto-embedding-generation).
   *
   * @example
   * ```ts
   * const users = await db.createCollection('users', {
   *   vector: {
   *     service: {
   *       provider: 'nvidia',
   *       modelName: 'NV-Embed-QA',
   *     },
   *   },
   * });
   *
   * // Now, `users` supports vector search
   * await users.insertOne({ $vectorize: 'I like cars!!!' });
   * await users.findOne({}, { sort: { $vectorize: 'I like cars!!!' } });
   * ```
   *
   * ----
   *
   * ##### Typing the collection, and much more information
   *
   * See the {@link Collection} class's documentation for information on how and why the {@link Collection} class is typed, any disclaimers related to it, and for so much more information in general.
   *
   * > **⚠️Warning:** Collections are _inherently untyped_; any typing is client-side to help with bug-catching.
   *
   * @param name - The name of the collection to create.
   * @param options - Options for the collection.
   *
   * @returns A promised reference to the newly created collection.
   *
   * @throws CollectionAlreadyExistsError - if the collection already exists and `checkExists` is `true` or unset.
   *
   * @see SomeDoc
   * @see db.collection
   */
  public async createCollection<WSchema extends SomeDoc, RSchema extends WithId<SomeDoc> = FoundDoc<WSchema>>(name: string, options?: CreateCollectionOptions<WSchema>): Promise<Collection<WSchema, RSchema>> {
    const command = {
      createCollection: {
        name: name,
        options: {
          defaultId: options?.defaultId,
          indexing: options?.indexing as any,
          vector: options?.vector,
        },
      },
    };

    await this.#httpClient.executeCommand(command, {
      timeoutManager: this.#httpClient.tm.single('collectionAdminTimeoutMs', {
        timeout: {
          collectionAdminTimeoutMs: (typeof options?.timeout === 'number') ? options.timeout : options?.timeout?.collectionAdminTimeoutMs,
          requestTimeoutMs: 0,
        },
      }),
      keyspace: options?.keyspace,
      extraLogInfo: { name },
    });

    return this.collection(name, options);
  }

  /**
   * ##### Overview (auto-infer-schema overload)
   *
   * Creates a new table in the database, and establishes a reference to it.
   *
   * This is a *blocking* command which performs actual I/O (unlike {@link Db.table}, which simply creates an
   * unvalidated reference to a table).
   *
   * ---
   *
   * ##### Overloads
   *
   * This overload of `createTable` infers the TS-equivalent schema of the table from the provided `CreateTableDefinition`.
   *
   * Provide an explicit `Schema` type to disable this (i.e. `db.createTable<Tyoe>(...)`).
   *
   * > **💡Tip**: You may use `db.createTable<SomeRow>(...)` to spawn an untyped table.
   *
   * ---
   *
   * ##### Type Inference
   *
   * The recommended way to type a table is to allow TypeScript to infer the type from the provided `CreateTableDefinition`.
   *
   * @example
   * ```ts
   * // Define the table schema
   * const UserSchema = Table.schema({
   *   columns: {
   *     name: 'text',
   *     dob: {
   *       type: 'timestamp',
   *     },
   *     friends: {
   *       type: 'set',
   *       valueType: 'text',
   *     },
   *   },
   *   primaryKey: {
   *     partitionBy: ['name'],
   *     partitionSort: { dob: 1 },
   *   },
   * });
   *
   * // Type inference is as simple as that
   * type User = InferTableSchema<typeof UserSchema>;
   *
   * // And now `User` can be used wherever.
   * const main = async () => {
   *   const table = await db.createTable('users', { definition: UserSchema });
   *   const found = await table.findOne({}); // found :: User | null
   * };
   * ```
   *
   * ---
   *
   * ##### Idempotency
   *
   * Creating a table is idempotent if the `ifNotExists` option is set to `true`. Otherwise, an error will be thrown if a table with the same name is thrown.
   *
   * > 🚨**Important:** When using `ifNotExists: true`, **only the existence of a table with the same name is checked.**
   * >
   * > If a table with that name already exists, but the columns (or any other options) you define differ from the existing table, **it won’t give you an error**; instead, it'll silently succeed, and the original table schema will be retained.
   *
   * ---
   *
   * ##### Typing the table, and much more information
   *
   * > **💡Tip:** You can use {@link InferTableSchema} to infer the TS-equivalent-type of the table from the provided `CreateTableDefinition`.
   *
   * See the {@link Table} class's documentation for information on how and why the {@link Table} class is typed, any disclaimers related to it, and for so much more information in general.
   *
   * @param name - The name of the table to create.
   * @param options - Options for the table.
   *
   * @returns A promised reference to the newly created table.
   *
   * @see SomeRow
   * @see db.table
   * @see InferTableSchema
   * @see InferTablePrimaryKey
   * @see CreateTableDefinition
   */
  public async createTable<const Def extends CreateTableDefinition>(name: string, options: CreateTableOptions<Def>): Promise<Table<InferTableSchema<Def>, InferTablePrimaryKey<Def>>>

  /**
   * ##### Overview (explicit-schema overload)
   *
   * Creates a new table in the database, and establishes a reference to it.
   *
   * This is a *blocking* command which performs actual I/O (unlike {@link Db.table}, which simply creates an
   * unvalidated reference to a table).
   *
   * ---
   *
   * ##### Overloads
   *
   * This overload of `createTable` uses the provided `Schema` type to type the Table.
   *
   * > **💡Tip**: It's recommended to allow TypeScript infer the type of the table from the provided `CreateTableDefinition` for you, via {@link InferTableSchema}. See its documentation for more information.
   *
   * Don't provide a `Schema` type if you want to automagically infer it from the `CreateTableDefinition`.
   *
   * Regardless, here is what a manually-typed table would look like:
   *
   * @example
   * ```ts
   * interface User {
   *   name: string,
   *   dob: DataAPIDate,
   *   friends?: Set<string>,
   * }
   *
   * type UserPK = Pick<User, 'name' | 'dob'>;
   *
   * const table = await db.createTable<User, UserPK>('users', {
   *   definition: {
   *     columns: {
   *       name: 'text',
   *       dob: {
   *         type: 'timestamp',
   *       },
   *       friends: {
   *         type: 'set',
   *         valueType: 'text',
   *       },
   *     },
   *     primaryKey: {
   *       partitionBy: ['name'],
   *       partitionSort: { dob: 1 },
   *     },
   *   },
   * });
   *
   * // found :: User | null
   * const found = await table.findOne({});
   * ```
   *
   * ---
   *
   * ##### Idempotency
   *
   * Creating a table is idempotent if the `ifNotExists` option is set to `true`. Otherwise, an error will be thrown if a table with the same name is thrown.
   *
   * > 🚨**Important:** When using `ifNotExists: true`, **only the existence of a table with the same name is checked.**
   * >
   * > If a table with that name already exists, but the columns (or any other options) you define differ from the existing table, **it won’t give you an error**; instead, it'll silently succeed, and the original table schema will be retained.
   *
   * ---
   *
   * ##### Typing the table, and much more information
   *
   * > **💡Tip:** You can use {@link InferTableSchema} to infer the TS-equivalent-type of the table from the provided `CreateTableDefinition`.
   *
   * See the {@link Table} class's documentation for information on how and why the {@link Table} class is typed, any disclaimers related to it, and for so much more information in general.
   *
   * @param name - The name of the table to create.
   * @param options - Options for the table.
   *
   * @returns A promised reference to the newly created table.
   *
   * @see SomeRow
   * @see db.table
   * @see InferTableSchema
   * @see InferTablePrimaryKey
   * @see CreateTableDefinition
   */
  public async createTable<WSchema extends SomeRow, PKeys extends SomePKey = Partial<FoundRow<WSchema>>, RSchema extends SomeRow = FoundRow<WSchema>>(name: string, options: CreateTableOptions): Promise<Table<WSchema, PKeys, RSchema>>

  public async createTable(name: string, options: CreateTableOptions): Promise<Table<SomeRow>> {
    const command = {
      createTable: {
        name: name,
        definition: options.definition,
        options: {
          ifNotExists: options.ifNotExists,
        },
      },
    };

    await this.#httpClient.executeCommand(command, {
      timeoutManager: this.#httpClient.tm.single('tableAdminTimeoutMs', options),
      extraLogInfo: { name, ifNotExists: options.ifNotExists ?? false },
      keyspace: options?.keyspace,
    });

    return this.table(name, options);
  }

  /**
   * ##### Overview
   *
   * Drops a collection from the database, including all the contained documents.
   *
   * You can also specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
   * instance.
   *
   * @example
   * ```typescript
   * // Uses db's working keyspace
   * const success1 = await db.dropCollection('users');
   * console.log(success1); // true
   *
   * // Overrides db's working keyspace
   * const success2 = await db.dropCollection('users', {
   *   keyspace: 'my_keyspace'
   * });
   * console.log(success2); // true
   * ```
   *
   * ---
   *
   * ##### Idempotency
   *
   * Dropping a collection is entirely idempotent; if the collection doesn't exist, it will simply do nothing.
   *
   * @param name - The name of the collection to drop.
   * @param options - Options for this operation.
   *
   * @returns A promise that resolves to `true` if the collection was dropped successfully.
   *
   * @remarks Use with caution. Have steel-toe boots on. Don't say I didn't warn you.
   */
  public async dropCollection(name: string, options?: DropCollectionOptions): Promise<void> {
    await this.#httpClient.executeCommand({ deleteCollection: { name } }, {
      timeoutManager: this.#httpClient.tm.single('collectionAdminTimeoutMs', options),
      keyspace: options?.keyspace,
      extraLogInfo: { name },
    });
  }

  /**
   * ##### Overview
   *
   * Drops a table from the database, including all the contained rows.
   *
   * You can also specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
   * instance.
   *
   * @example
   * ```typescript
   * // Uses db's working keyspace
   * const success1 = await db.dropTable('users');
   * console.log(success1); // true
   *
   * // Overrides db's working keyspace
   * const success2 = await db.dropTable('users', {
   *   keyspace: 'my_keyspace'
   * });
   * console.log(success2); // true
   * ```
   *
   * ---
   *
   * ##### Idempotency
   *
   * Dropping a table is entirely idempotent, _if_ the `ifExists` option is set to `true`, in which case, if the table doesn't exist, it will simply do nothing.
   *
   * If `ifExists` is `false` or unset, an error will be thrown if the table does not exist.
   *
   * @param name - The name of the table to drop.
   * @param options - Options for this operation.
   *
   * @returns A promise that resolves to `true` if the table was dropped successfully.
   *
   * @remarks Use with caution. Wear a mask. Don't say I didn't warn you.
   */
  public async dropTable(name: string, options?: DropTableOptions): Promise<void> {
    await this.#httpClient.executeCommand({ dropTable: { name, options: { ifExists: options?.ifExists } } }, {
      timeoutManager: this.#httpClient.tm.single('tableAdminTimeoutMs', options),
      extraLogInfo: { name, ifExists: options?.ifExists ?? false },
      keyspace: options?.keyspace,
    });
  }

  /**
   * ##### Overview
   *
   * Drops an index from the keyspace.
   *
   * See {@link Table.createIndex} & {@link Table.createVectorIndex} about creating indexes in the first place.
   *
   * ---
   *
   * ##### Name uniqueness
   *
   * > **🚨Important**: The name of the index is unique per keyspace.
   *
   * _This is why this is a database-level command: to make it clear that the index is being dropped from the keyspace, and not a specific table._
   *
   * ---
   *
   * ##### Idempotency
   *
   * Dropping an index is entirely idempotent, if the `ifExists` option is set to `true`, in which case, if the index doesn't exist, it will simply do nothing.
   *
   * If `ifExists` is `false` or unset, an error will be thrown if the index does not exist.
   *
   * @param name - The name of the index to drop.
   * @param options - The options for this operation.
   *
   * @returns A promise that resolves when the index is dropped.
   */
  public async dropTableIndex(name: string, options?: TableDropIndexOptions): Promise<void> {
    const dropOpts = (options?.ifExists)
      ? { ifExists: true }
      : undefined;

    await this.#httpClient.executeCommand({ dropIndex: { name, options: dropOpts } }, {
      timeoutManager: this.#httpClient.tm.single('tableAdminTimeoutMs', options),
      extraLogInfo: { name, ifExists: options?.ifExists ?? false },
      keyspace: options?.keyspace,
    });
  }

  /**
   * ##### Overview (name-only overload)
   *
   * Lists the collection names in the database.
   *
   * > **💡Tip:** If you want to include the collections' options in the response, set `nameOnly` to `false` (or omit it completely) to use the other `listCollections` overload.
   *
   * You can specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
   * instance.
   *
   * @example
   * ```typescript
   * // ['users', 'posts']
   * console.log(await db.listCollections({ nameOnly: true }));
   * ```
   *
   * @param options - Options for this operation.
   *
   * @returns A promise that resolves to an array of collection names.
   */
  public async listCollections(options: ListCollectionsOptions & { nameOnly: true }): Promise<string[]>

  /**
   * ##### Overview (full-info overload)
   *
   * Lists the collections in the database.
   *
   * > **💡Tip:** If you want to use only the collection names, set `nameOnly` to `true` to use the other `listCollections` overload.
   *
   * You can specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
   * instance.
   *
   * @example
   * ```typescript
   * // [{ name: 'users' }, { name: 'posts', options: { ... } }]
   * console.log(await db.listCollections());
   * ```
   *
   * @param options - Options for this operation.
   *
   * @returns A promise that resolves to an array of collection info.
   */
  public async listCollections(options?: ListCollectionsOptions & { nameOnly?: false }): Promise<CollectionDescriptor[]>

  public async listCollections(options?: ListCollectionsOptions): Promise<string[] | CollectionDescriptor[]> {
    const explain = options?.nameOnly !== true;

    const command = {
      findCollections: {
        options: { explain },
      },
    };

    const resp = await this.#httpClient.executeCommand(command, {
      timeoutManager: this.#httpClient.tm.single('collectionAdminTimeoutMs', options),
      extraLogInfo: { nameOnly: !explain },
      keyspace: options?.keyspace,
    });

    const colls = resp.status!.collections;

    if (explain) {
      for (let i = 0, n = colls.length; i < n; i++) {
        colls[i].definition = colls[i].options;
        delete colls[i].options;
      }
    }

    return colls;
  }

  /**
   * ##### Overview (name-only overload)
   *
   * Lists the table names in the database.
   *
   * > **💡Tip:** If you want to include the tables' options in the response, set `nameOnly` to `false` (or omit it completely) to use the other `listTables` overload.
   *
   * You can specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
   * instance.
   *
   * @example
   * ```typescript
   * // ['users', 'posts']
   * console.log(await db.listTables({ nameOnly: true }));
   * ```
   *
   * @param options - Options for this operation.
   *
   * @returns A promise that resolves to an array of table names.
   */
  public async listTables(options: ListTablesOptions & { nameOnly: true }): Promise<string[]>

  /**
   * ##### Overview (full-info overload)
   *
   * Lists the tables in the database.
   *
   * > **💡Tip:** If you want to use only the table names, set `nameOnly` to `true` to use the other `listTables` overload.
   *
   * You can specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
   * instance.
   *
   * @example
   * ```typescript
   * // [{ name: 'users' }, { name: 'posts', definition: { ... } }]
   * console.log(await db.listTables());
   * ```
   *
   * @param options - Options for this operation.
   *
   * @returns A promise that resolves to an array of table info.
   */
  public async listTables(options?: ListTablesOptions & { nameOnly?: false }): Promise<TableDescriptor[]>

  public async listTables(options?: ListTablesOptions): Promise<string[] | TableDescriptor[]> {
    const explain = options?.nameOnly !== true;

    const command = {
      listTables: {
        options: { explain },
      },
    };

    const resp = await this.#httpClient.executeCommand(command, {
      timeoutManager: this.#httpClient.tm.single('tableAdminTimeoutMs', options),
      extraLogInfo: { nameOnly: !explain },
      keyspace: options?.keyspace,
    });
    return resp.status!.tables;
  }

  /**
   * ##### Overview
   *
   * Sends a POST request to the Data API for this database with an arbitrary, caller-provided payload.
   *
   * You can specify a table/collection to target in the options parameter, thereby allowing you to perform
   * arbitrary table/collection-level operations as well.
   *
   * If the keyspace is set to `null`, the command will be run at the database level.
   *
   * If no table/collection is specified, the command will be executed at the keyspace level.
   *
   * You can also specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
   * instance.
   *
   * @example
   * ```typescript
   * const colls = await db.command({ findCollections: {} });
   * console.log(colls); // { status: { collections: ['users'] } }
   *
   * const user = await db.command({ findOne: {} }, { collection: 'users' });
   * console.log(user); // { data: { document: null } }
   *
   * const post = await db.command({ findOne: {} }, { table: 'posts' });
   * console.log(post); // { data: { document: null } }
   * ```
   *
   * @param command - The command to send to the Data API.
   * @param options - Options for this operation.
   *
   * @returns A promise that resolves to the raw response from the Data API.
   */
  public async command(command: Record<string, any>, options?: RunCommandOptions): Promise<RawDataAPIResponse> {
    return await this.#httpClient.executeCommand(command, {
      timeoutManager: this.#httpClient.tm.single('generalMethodTimeoutMs', options),
      keyspace: options?.keyspace,
      collection: options?.collection,
      extraLogInfo: options?.extraLogInfo ?? { source: 'db.command' },
      table: options?.table,
    });
  }

  /**
   * Backdoor to the HTTP client for if it's absolutely necessary. Which it almost never (if even ever) is.
   */
  public get _httpClient(): OpaqueHttpClient {
    return this.#httpClient;
  }

  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - The `namespace` terminology has been removed, and replaced with `keyspace` throughout the client.
   */
  public declare useNamespace: 'ERROR: The `namespace` terminology has been removed, and replaced with `keyspace` throughout the client';

  /**
   * *This temporary error-ing property exists for migration convenience, and will be removed in a future version.*
   *
   * @deprecated - `.collections` has been removed. Use `.listCollections` with `.map` instead (`await db.listCollections({ nameOnly: true }).then(cs => cs.map(c => db.collection(c))`)
   */
  public declare collections: 'ERROR: `.collections` has been removed. Use `.listCollections` with `.map` instead';
}
