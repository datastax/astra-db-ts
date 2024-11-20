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

import { Collection, SomeDoc } from '@/src/documents/collections';
import { DEFAULT_KEYSPACE, RawDataAPIResponse, WithTimeout } from '@/src/lib/api';
import { AstraDbAdmin } from '@/src/administration/astra-db-admin';
import { DataAPIEnvironment, nullish } from '@/src/lib/types';
import { extractDbIdFromUrl, extractRegionFromUrl } from '@/src/documents/utils';
import { DbAdmin } from '@/src/administration';
import { DataAPIDbAdmin } from '@/src/administration/data-api-db-admin';
import { CreateCollectionOptions } from '@/src/db/types/collections/create-collection';
import { TokenProvider } from '@/src/lib';
import { DataAPIHttpClient, EmissionStrategy } from '@/src/lib/api/clients/data-api-http-client';
import { KeyspaceRef } from '@/src/lib/api/clients/types';
import { validateDataAPIEnv } from '@/src/lib/utils';
import { EmbeddingHeadersProvider, SomeRow, Table, TableDropIndexOptions } from '@/src/documents';
import { DEFAULT_DATA_API_PATHS } from '@/src/lib/api/constants';
import { CollectionOptions } from '@/src/db/types/collections/collection-options';
import { DropCollectionOptions } from '@/src/db/types/collections/drop-collection';
import { FullCollectionInfo, ListCollectionsOptions } from '@/src/db/types/collections/list-collections';
import { RunCommandOptions } from '@/src/db/types/command';
import { TableOptions } from '@/src/db/types/tables/spawn-table';
import { CreateTableDefinition, CreateTableOptions } from '@/src/db/types/tables/create-table';
import { InferTableSchemaFromDefinition } from '@/src/db/types/tables/table-schema';
import { DropTableOptions } from '@/src/db/types/tables/drop-table';
import { FullTableInfo, ListTablesOptions } from '@/src/db/types/tables/list-tables';
import { parseDbSpawnOpts } from '@/src/client/parsers/spawn-db';
import { AdminOptions, DbOptions } from '@/src/client/types';
import { InternalRootClientOpts } from '@/src/client/types/internal';
import { Logger } from '@/src/lib/logging/logger';
import { $CustomInspect } from '@/src/lib/constants';
import { InvalidEnvironmentError } from '@/src/db/errors';
import { AstraDbInfo } from '@/src/administration/types/admin/database-info';
import { Timeouts } from '@/src/lib/api/timeouts';
import { CollectionSerDes } from '@/src/documents/collections/ser-des';
import { TableSerDes } from '@/src/documents/tables/ser-des';

/**
 * #### Overview
 *
 * Represents an interface to some Data-API-enabled database instance. This is the entrypoint for database-level DML, such as
 * creating/deleting collections/tables, connecting to collections/tables, and executing arbitrary commands.
 *
 * **Shouldn't be instantiated directly; use {@link DataAPIClient.db} to obtain an instance of this class.**
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
 *   keyspace: 'my_keyspace',
 *   useHttp2: false,
 * });
 * ```
 *
 * ###### The "working keyspace"
 *
 * The `Db` class has a concept of a "working keyspace", which is the default keyspace used for all operations in the database. This can be overridden in each method call, but if not, the default keyspace is used.
 *
 * If no explicit keyspace is provided when creating the `Db` instance, it will default to:
 * - On DataStax Astra dbs: `default_keyspace`
 * - On all other dbs, it will remain undefined
 *   - In this case, the keyspace must be set using either:
 *     - The `db.useKeyspace()` mutator method
 *     - The `updateDbKeyspace` parameter in `dbAdmin.createKeyspace()`
 *
 * Changing the working namespaces does NOT retroactively update any collections/tables spawned from this `Db` instance.
 *
 * See {@link Db.useKeyspace} and {@link DbAdmin.createKeyspace} for more information.
 *
 * @example
 * ```ts
 * // Method 1:
 * db.useKeyspace('my_keyspace');
 *
 * // Method 2:
 * // (If using non-astra, this may be a common idiom)
 * await db.admin().createKeyspace('my_keyspace', {
 *   updateDbKeyspace: true,
 * });
 * ```
 *
 * ###### Astra vs. non-Astra
 *
 * The `Db` class is designed to work with both Astra and non-Astra databases. However, there are some differences in behaviour between the two:
 * - Astra DBs have an ID & region, which can be accessed using `db.id` and `db.region` respectively
 * - Astra DBs have a `db.info()` method, which provides detailed information about the database
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
export class Db {
  readonly #defaultOpts: InternalRootClientOpts;
  readonly #httpClient: DataAPIHttpClient;

  readonly #endpoint: string;
  readonly #keyspace: KeyspaceRef;
  readonly #id?: string;
  readonly #region?: string;

  /**
   * Use {@link DataAPIClient.db} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(rootOpts: InternalRootClientOpts, endpoint: string, rawDbOpts: DbOptions | nullish) {
    const dbOpts = parseDbSpawnOpts(rawDbOpts, 'options');

    this.#defaultOpts = {
      ...rootOpts,
      dbOptions: {
        keyspace: dbOpts?.keyspace ?? rootOpts.dbOptions.keyspace,
        dataApiPath: dbOpts?.dataApiPath ?? rootOpts.dbOptions.dataApiPath,
        token: TokenProvider.mergeTokens(dbOpts?.token, rootOpts.dbOptions.token),
        logging: Logger.advanceConfig(rootOpts.dbOptions.logging, dbOpts?.logging),
        additionalHeaders: { ...rootOpts.dbOptions.additionalHeaders, ...dbOpts?.additionalHeaders },
        timeoutDefaults: Timeouts.merge(rootOpts.dbOptions.timeoutDefaults, dbOpts?.timeoutDefaults),
        serdes: {
          collection: CollectionSerDes.mergeConfig(rootOpts.dbOptions.serdes?.collection, dbOpts?.serdes?.collection, dbOpts?.serdes),
          table: TableSerDes.mergeConfig(rootOpts.dbOptions.serdes?.table, dbOpts?.serdes?.table, dbOpts?.serdes),
        },
      },
      adminOptions: {
        ...rootOpts.adminOptions,
        adminToken: TokenProvider.mergeTokens(rootOpts.adminOptions.adminToken, rootOpts.dbOptions.token),
      },
    };

    this.#keyspace = {
      ref: (rootOpts.environment === 'astra')
        ? this.#defaultOpts.dbOptions.keyspace ?? DEFAULT_KEYSPACE
        : this.#defaultOpts.dbOptions.keyspace ?? undefined,
    };

    this.#httpClient = new DataAPIHttpClient({
      baseUrl: endpoint,
      tokenProvider: this.#defaultOpts.dbOptions.token,
      embeddingHeaders: EmbeddingHeadersProvider.parseHeaders(null),
      baseApiPath: this.#defaultOpts.dbOptions.dataApiPath || DEFAULT_DATA_API_PATHS[rootOpts.environment],
      emitter: rootOpts.emitter,
      logging: this.#defaultOpts.dbOptions.logging,
      fetchCtx: rootOpts.fetchCtx,
      keyspace: this.#keyspace,
      userAgent: rootOpts.userAgent,
      emissionStrategy: EmissionStrategy.Normal,
      additionalHeaders: this.#defaultOpts.dbOptions.additionalHeaders,
      timeoutDefaults: this.#defaultOpts.dbOptions.timeoutDefaults,
    });

    this.#id = extractDbIdFromUrl(endpoint);
    this.#region = extractRegionFromUrl(endpoint);
    this.#endpoint = endpoint;

    Object.defineProperty(this, $CustomInspect, {
      value: () => `Db(endpoint="${this.#endpoint}",keyspace="${this.keyspace}")`,
    });
  }

  /**
   * The default keyspace to use for all operations in this database, unless overridden in a method call.
   *
   * @example
   * ```typescript
   * // Uses 'default_keyspace' as the default keyspace for all future db spawns
   * const client1 = new DataAPIClient('*TOKEN*');
   *
   * // Overrides the default keyspace for all future db spawns
   * const client2 = new DataAPIClient('*TOKEN*', {
   *   dbOptions: { keyspace: 'my_keyspace' },
   * });
   *
   * // Created with 'default_keyspace' as the default keyspace
   * const db1 = client1.db('*ENDPOINT*');
   *
   * // Created with 'my_keyspace' as the default keyspace
   * const db2 = client1.db('*ENDPOINT*', {
   *   keyspace: 'my_keyspace'
   * });
   *
   * // Uses 'default_keyspace'
   * const coll1 = db1.collection('users');
   *
   * // Uses 'my_keyspace'
   * const coll2 = db1.collection('users', {
   *   keyspace: 'my_keyspace'
   * });
   * ```
   */
  public get keyspace(): string {
    if (!this.#keyspace.ref) {
      throw new Error('No keyspace set for DB (can\'t do db.keyspace, or perform any operation requiring it). Use `db.useKeyspace`, or pass the keyspace as an option parameter explicitly.');
    }
    return this.#keyspace.ref;
  }

  /**
   * The ID of the database (UUID), if it's an Astra database.
   *
   * If it's not an Astra database, this will throw an error, as they have no applicable/appropriate ID.
   *
   * @throws InvalidEnvironmentError - if the database is not an Astra database.
   */
  public get id(): string {
    if (this.#defaultOpts.environment !== 'astra') {
      throw new InvalidEnvironmentError('db.id', this.#defaultOpts.environment, ['astra'], 'non-Astra databases have no appropriate ID');
    }
    if (!this.#id) {
      throw new Error(`Malformed AstraDB endpoint URL '${this.#endpoint}'—database ID unable to be parsed`);
    }
    return this.#id;
  }

  /**
   * The region of the database (e.g. `'us-east-1'`), if it's an Astra database.
   *
   * If it's not an Astra database, this will throw an error, as they have no applicable/appropriate region.
   *
   * @throws InvalidEnvironmentError - if the database is not an Astra database.
   */
  public get region(): string {
    if (this.#defaultOpts.environment !== 'astra') {
      throw new InvalidEnvironmentError('db.region', this.#defaultOpts.environment, ['astra'], 'non-Astra databases have no appropriate region');
    }
    if (!this.#region) {
      throw new Error(`Malformed AstraDB endpoint URL '${this.#endpoint}'—database region unable to be parsed`);
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
   *   updateDbKeyspace: true,
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
   * ##### Overview
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
   * ##### Astra vs. non-Astra
   *
   * **If using a non-Astra backend, the `environment` option MUST be set as it is on the `DataAPIClient`**
   *
   * If on Astra, this method will return a new {@link AstraDbAdmin} instance, which provides a few extra methods
   * for Astra databases, such as {@link AstraDbAdmin.info} or {@link AstraDbAdmin.drop}.
   *
   * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
   *
   * @returns A new {@link AstraDbAdmin} instance for this database instance.
   *
   * @throws InvalidEnvironmentError - if the database is not an Astra database.
   */
  public admin(options?: AdminOptions & { environment?: 'astra' }): AstraDbAdmin

  /**
   * ##### Overview
   *
   * Spawns a new {@link DataAPIDbAdmin} instance for this database, used for performing administrative operations
   * on the database, such as managing keyspaces, or getting database information.
   *
   * The given options will override any default options set when creating the {@link DataAPIClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
   *
   * **If using a non-Astra backend, the `environment` option MUST be set as it is on the `DataAPIClient`**
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
   * ##### Astra vs. non-Astra
   *
   * **If using a non-Astra backend, the `environment` option MUST be set as it is on the `DataAPIClient`**
   *
   * If on non-Astra, this method will return a new {@link DataAPIDbAdmin} instance, which conforms strictly to the
   * {@link DbAdmin} interface, with the {@link DataAPIDbAdmin.createKeyspace} method being the only method that
   * differs slightly from the interface version.
   *
   * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
   *
   * @returns A new {@link AstraDbAdmin} instance for this database instance.
   *
   * @throws InvalidEnvironmentError - if the database is not an Astra database.
   */
  public admin(options: AdminOptions & { environment: Exclude<DataAPIEnvironment, 'astra'> }): DataAPIDbAdmin

  public admin(options?: AdminOptions & { environment?: DataAPIEnvironment }): DbAdmin {
    const environment = options?.environment ?? 'astra';

    validateDataAPIEnv(environment);

    if (this.#defaultOpts.environment !== environment) {
      throw new InvalidEnvironmentError('db.admin()', environment, [this.#defaultOpts.environment], 'environment option is not the same as set in the DataAPIClient');
    }

    if (environment === 'astra') {
      return new AstraDbAdmin(this, this.#defaultOpts, options, this.#defaultOpts.dbOptions.token, this.#endpoint!);
    }

    return new DataAPIDbAdmin(this, this.#httpClient, options);
  }

  /**
   * ##### Overview
   *
   * Fetches information about the database, such as the database name, region, and other metadata.
   *
   * **NOTE: Only available for Astra databases.**
   *
   * For the full, complete, information, see {@link AstraDbAdmin.info}.
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
   * ##### On non-Astra
   *
   * This operation requires a call to the DevOps API, which is only available on Astra databases. As such, this method
   * will throw an error if the database is not an Astra database.
   *
   * @returns A promise that resolves to the database information.
   *
   * @throws Error - if the database is not an Astra database.
   */
  public async info(options?: WithTimeout<'databaseAdminTimeoutMs'>): Promise<AstraDbInfo> {
    if (this.#defaultOpts.environment !== 'astra') {
      throw new InvalidEnvironmentError('db.info()', this.#defaultOpts.environment, ['astra'], 'info() is only available for Astra databases');
    }

    const data = await this.admin().info(options);

    const region = this.#endpoint
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
      apiEndpoint: this.#endpoint,
      raw: data.raw.info,
    };
  }

  /**
   * ##### Overview
   *
   * Establishes a reference to a collection in the database. This method does not perform any I/O.
   *
   * **NOTE: This method does not validate the existence of the collection—it simply creates a reference.**
   *
   * @example
   * ```ts
   * interface User {
   *   name: string,
   *   age?: number,
   * }
   *
   * // Basic usage
   * const users1 = db.collection<User>('users');
   * users1.insertOne({ name: 'John' });
   *
   * // Untyped collection from different keyspace
   * const users2 = db.collection('users', {
   *   keyspace: 'my_keyspace',
   * });
   * users2.insertOne({ 'anything[you]$want': 'John' }); // Dangerous
   * ```
   *
   * ##### No I/O
   *
   * **Unlike the MongoDB Node.js driver, this method does not create a collection if it doesn't exist.**
   *
   * Use {@link Db.createCollection} to create a new collection instead.
   *
   * ##### Typing & Types
   *
   * Collections are inherently untyped, but you can provide your own client-side compile-time schema for type inference and early-bug-catching purposes.
   *
   * A `Collection` is typed as `Collection<Schema extends SomeDoc = SomeDoc>`, where:
   * - `Schema` is the user-intended type of the documents in the collection.
   * - `SomeDoc` is set to `Record<string, any>`, representing any valid JSON object.
   *
   * Certain datatypes may be represented as TypeScript classes (some native, some provided by `astra-db-ts`), however.
   *
   * You may also provide your own datatypes by providing some custom serialization logic as well (see later section).
   *
   * Please see {@link Collection} for *much* more info on typing them, and more.
   *
   * @example
   * ```ts
   * import { UUID, DataAPIVector, ... } from 'astra-db-ts';
   *
   * interface User {
   *   _id: string,
   *   dob: Date,
   *   friends?: Record<string, UUID>, // UUID is also `astra-db-ts` provided
   *   vector: DataAPIVector,
   * }
   *
   * const collection = db.collection<User>('users');
   *
   * // res.insertedId is of type string
   * const res = await collection.insertOne({
   *   _id: '123',
   *   dob: new Date(),
   *   friends: { 'Alice': UUID.random() },
   *   vector: new DataAPIVector([1, 2, 3]), // This can also be passed as a number[]
   * });
   * ```
   *
   * ###### Disclaimer
   *
   * **Collections are inherently untyped**
   *
   * **It is on the user to ensure that the TS type of the `Collection` corresponds with the actual CQL table schema, in its TS-deserialized form. Incorrect or dynamic tying could lead to surprising behaviours and easily-preventable errors.**
   *
   * **There is no runtime type validation or enforcement of the schema.**
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
  public collection<Schema extends SomeDoc = SomeDoc>(name: string, options?: CollectionOptions<Schema>): Collection<Schema> {
    return new Collection<Schema>(this, this.#httpClient, name, {
      ...options,
      serdes: CollectionSerDes.mergeConfig(options?.serdes, this.#defaultOpts.dbOptions.serdes?.collection),
    });
  }

  /**
   * ##### Overview
   *
   * Establishes a reference to a table in the database. This method does not perform any I/O.
   *
   * **NOTE: This method does not validate the existence of the table—it simply creates a reference.**
   *
   * @example
   * ```ts
   * interface User {
   *   name: string,
   *   age?: number,
   * }
   *
   * // Basic usage
   * const users1 = db.table<User>('users');
   * users1.insertOne({ name: 'John' });
   *
   * // Untyped table from different keyspace
   * const users2 = db.table('users', {
   *   keyspace: 'my_keyspace',
   * });
   * users2.insertOne({ 'anything[you]$want': 'John' }); // Dangerous
   * ```
   *
   * ##### No I/O
   *
   * **This method does not create a table if it doesn't exist.**
   *
   * Use {@link Db.createTable} to create a new table instead.
   *
   * ##### Typing & Types
   *
   * A `Table` is typed as `Table<Schema extends SomeRow = SomeRow>`, where:
   *  - `Schema` is the type of the rows in the table (the table schema).
   *  - `SomeRow` is set to `Record<string, any>`, representing any valid JSON object.
   *
   * Certain datatypes may be represented as TypeScript classes (some native, some provided by `astra-db-ts`), however.
   *
   * You may also provide your own datatypes by providing some custom serialization logic as well (see later section).
   *
   * ***Please see {@link Table} for *much* more info on typing them, and more.***
   *
   * @example
   * ```ts
   * import { DataAPIDate, UUID, Row, DataAPIVector, ... } from 'astra-db-ts';
   *
   * interface User extends Row<User, 'id' | 'dob'> {
   *   id: string,   // Partition key
   *   dob: DataAPIDate, // Clustering (partition sort) key
   *   friends: Map<string, UUID>,
   *   vector: DataAPIVector,
   * }
   *
   * const table = db.table<User>('users');
   *
   * // res.insertedId is of type { id: string }
   * const res = await table.insertOne({
   *   id: '123',
   *   dob: new DataAPIDate(new Date()),
   *   friends: new Map([['Alice', UUID.random()]]),
   *   vector: new DataAPIVector([1, 2, 3]), // Class enables encoding optimization
   * });
   * ```
   *
   * ###### Disclaimer
   *
   * *It is on the user to ensure that the TS type of the `Table` corresponds with the actual CQL table schema, in its TS-deserialized form. Incorrect or dynamic tying could lead to surprising behaviours and easily-preventable errors.*
   *
   * See {@link Db.createTable}, {@link Db.table}, and {@link InferTableSchema} for much more information about typing.
   *
   * @param name - The name of the table.
   * @param options - Options for spawning the table.
   *
   * @returns A new, unvalidated, reference to the table.
   *
   * @see SomeRow
   * @see db.createTable
   * @see InferTableSchema
   * @see Row
   * @see $PrimaryKeyType
   */
  public table<Schema extends SomeRow = SomeRow>(name: string, options?: TableOptions<Schema>): Table<Schema> {
    return new Table<Schema>(this, this.#httpClient, name, {
      ...options,
      serdes: TableSerDes.mergeConfig(options?.serdes, this.#defaultOpts.dbOptions.serdes?.table),
    });
  }

  /**
   * ##### Overview
   *
   * Creates a new collection in the database, and establishes a reference to it.
   *
   * This is a *blocking* command which performs actual I/O (unlike {@link Db.collection}, which simply creates an
   * unvalidated reference to a collection).
   *
   * @example
   * ```ts
   * // Most basic usage
   * const users = await db.createCollection('users');
   *
   * // With custom options in a different keyspace
   * const users2 = await db.createCollection('users', {
   *   keyspace: 'my_keyspace',
   *   defaultId: {
   *     type: 'objectId',
   *   },
   * });
   * ```
   *
   * ##### Idempotency
   *
   * Creating a collection is idempotent as long as the options remain the same; if the collection already exists with the same options, a {@link DataAPIResponseError} will be thrown.
   *
   * ("options" mean the `createCollection` options actually sent to the server, not things like `maxTimeMS` which are just client-side).
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
   *   vector: {
   *     service: {
   *       provider: 'nvidia',
   *       modelName: 'NV-Embed-QA',
   *     },
   *   },
   * });
   *
   * // Now, `users` supports vector search
   * await users.insertOne({ $vectorize: 'I like cars!!!' });
   * await users.fineOne({}, { sort: { $vectorize: 'I like cars!!!' } });
   * ```
   *
   * ##### Typing & Types
   *
   * Collections are inherently untyped, but you can provide your own client-side compile-time schema for type inference and early-bug-catching purposes.
   *
   * A `Collection` is typed as `Collection<Schema extends SomeDoc = SomeDoc>`, where:
   * - `Schema` is the user-intended type of the documents in the collection.
   * - `SomeDoc` is set to `Record<string, any>`, representing any valid JSON object.
   *
   * Certain datatypes may be represented as TypeScript classes (some native, some provided by `astra-db-ts`), however.
   *
   * You may also provide your own datatypes by providing some custom serialization logic as well (see later section).
   *
   * Please see {@link Collection} for *much* more info on typing them, and more.
   *
   * @example
   * ```ts
   * import { UUID, DataAPIVector, ... } from 'astra-db-ts';
   *
   * interface User {
   *   _id: string,
   *   dob: Date,
   *   friends?: Record<string, UUID>, // UUID is also `astra-db-ts` provided
   *   vector: DataAPIVector,
   * }
   *
   * const collection = await db.createCollection<User>('users');
   *
   * // res.insertedId is of type string
   * const res = await collection.insertOne({
   *   _id: '123',
   *   dob: new Date(),
   *   friends: { 'Alice': UUID.random() },
   *   vector: new DataAPIVector([1, 2, 3]), // This can also be passed as a number[]
   * });
   * ```
   *
   * ##### Disclaimer
   *
   * **Collections are inherently untyped**
   *
   * **It is on the user to ensure that the TS type of the `Collection` corresponds with the actual CQL table schema, in its TS-deserialized form. Incorrect or dynamic tying could lead to surprising behaviours and easily-preventable errors.**
   *
   * **There is no runtime type validation or enforcement of the schema.**
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
  public async createCollection<Schema extends SomeDoc = SomeDoc>(name: string, options?: CreateCollectionOptions<Schema>): Promise<Collection<Schema>> {
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
    });

    return this.collection(name, options);
  }

  /**
   * ##### Overview
   *
   * Creates a new table in the database, and establishes a reference to it.
   *
   * This is a *blocking* command which performs actual I/O (unlike {@link Db.table}, which simply creates an
   * unvalidated reference to a table).
   *
   * ##### Overloads
   *
   * *This overload of `createTable` infers the TS-equivalent schema of the table from the provided `CreateTableDefinition`.*
   *
   * *Provide an explicit `Schema` type to disable this (e.g. `db.createTable<SomeRow>(...)`).*
   *
   * @example
   * ```ts
   * // Function to create the actual table
   * const mkUserTable = () => db.createTable('users', {
   *   definition: {
   *     columns: {
   *       name: 'text',
   *       dob: {
   *         type: 'timestamp',
   *       },
   *       friends: {
   *         type: 'set',
   *         valueType: 'text',
   *       },
   *     },
   *     primaryKey: {
   *       partitionBy: ['name', 'height'],
   *       partitionSort: { dob: 1 },
   *     },
   *   },
   * });
   *
   * // Type inference is as simple as that
   * type User = InferTableSchema<typeof mkUserTable>;
   *
   * // And now `User` can be used wherever.
   * const main = async () => {
   *   const table = await mkUserTable();
   *   const found: User | null = await table.findOne({});
   * };
   * ```
   *
   * ##### Idempotency
   *
   * Creating a table is idempotent if the `ifNotExists` option is set to `true`. Otherwise, an error will be thrown if a table with the same name is thrown.
   *
   * If a table is "recreated" with the same name & `ifNotExists` is set to `true`, but the columns definition differ, the operation will silently succeed, **but the original table schema will be retained**.
   *
   * ##### Typing & Types
   *
   * A `Table` is typed as `Table<Schema extends SomeRow = SomeRow>`, where:
   *  - `Schema` is the type of the rows in the table (the table schema).
   *  - `SomeRow` is set to `Record<string, any>`, representing any valid JSON object.
   *
   * Certain datatypes may be represented as TypeScript classes (some native, some provided by `astra-db-ts`), however.
   *
   * You may also provide your own datatypes by providing some custom serialization logic as well (see later section).
   *
   * ***Please see {@link Table} for *much* more info on typing them, and more.***
   *
   * ##### Disclaimer
   *
   * *It is on the user to ensure that the TS type of the `Table` corresponds with the actual CQL table schema, in its TS-deserialized form. Incorrect or dynamic tying could lead to surprising behaviours and easily-preventable errors.*
   *
   * See {@link Db.createTable}, {@link Db.table}, and {@link InferTableSchema} for much more information about typing.
   *
   * @param name - The name of the table to create.
   * @param options - Options for the table.
   *
   * @returns A promised reference to the newly created table.
   *
   * @see SomeRow
   * @see db.table
   * @see InferTableSchema
   * @see Row
   * @see $PrimaryKeyType
   * @see CreateTableDefinition
   */
  public async createTable<const Def extends CreateTableDefinition>(name: string, options: CreateTableOptions<InferTableSchemaFromDefinition<Def>, Def>): Promise<Table<InferTableSchemaFromDefinition<Def>>>

  /**
   * ##### Overview
   *
   * Creates a new table in the database, and establishes a reference to it.
   *
   * This is a *blocking* command which performs actual I/O (unlike {@link Db.table}, which simply creates an
   * unvalidated reference to a table).
   *
   * ##### Overloads
   *
   * *This overload of `createTable` uses the provided `Schema` type to type the Table.*
   *
   * *Don't provide a `Schema` type if you want to infer it from the `CreateTableDefinition` via {@link InferTableSchema}.*
   *
   * @example
   * ```ts
   * interface User extends Row<User, 'name' | 'dob'> {
   *   name: string,
   *   dob: DataAPIDate,
   *   friends?: Set<string>,
   * }
   *
   * const table = await db.createTable<User>('users', {
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
   * const found: User | null = await table.findOne({});
   * ```
   *
   * ##### Idempotency
   *
   * Creating a table is idempotent if the `ifNotExists` option is set to `true`. Otherwise, an error will be thrown if a table with the same name is thrown.
   *
   * If a table is "recreated" with the same name & `ifNotExists` is set to `true`, but the columns definition differ, the operation will silently succeed, **but the original table schema will be retained**.
   *
   * ##### Typing & Types
   *
   * A `Table` is typed as `Table<Schema extends SomeRow = SomeRow>`, where:
   *  - `Schema` is the type of the rows in the table (the table schema).
   *  - `SomeRow` is set to `Record<string, any>`, representing any valid JSON object.
   *
   * Certain datatypes may be represented as TypeScript classes (some native, some provided by `astra-db-ts`), however.
   *
   * You may also provide your own datatypes by providing some custom serialization logic as well (see later section).
   *
   * ***Please see {@link Table} for *much* more info on typing them, and more.***
   *
   * ##### Disclaimer
   *
   * *It is on the user to ensure that the TS type of the `Table` corresponds with the actual CQL table schema, in its TS-deserialized form. Incorrect or dynamic tying could lead to surprising behaviours and easily-preventable errors.*
   *
   * See {@link Db.createTable}, {@link Db.table}, and {@link InferTableSchema} for much more information about typing.
   *
   * @param name - The name of the table to create.
   * @param options - Options for the table.
   *
   * @returns A promised reference to the newly created table.
   *
   * @see SomeRow
   * @see db.table
   * @see InferTableSchema
   * @see Row
   * @see $PrimaryKeyType
   * @see CreateTableDefinition
   */
  public async createTable<Schema extends SomeRow>(name: string, options: CreateTableOptions<Schema>): Promise<Table<Schema>>

  public async createTable(name: string, options: CreateTableOptions<SomeRow>): Promise<Table> {
    const command = {
      createTable: {
        name: name,
        definition: options.definition,
        options: {
          ifNotExists: options.ifNotExists ?? false,
        },
      },
    };

    await this.#httpClient.executeCommand(command, {
      timeoutManager: this.#httpClient.tm.single('tableAdminTimeoutMs', options),
      keyspace: options?.keyspace,
    });

    return this.table(name, options);
  }

  /**
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
   *   keyspace: 'my_keyspace'
   * });
   * console.log(success2); // true
   * ```
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
    });
  }

  /**
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
   *   keyspace: 'my_keyspace'
   * });
   * console.log(success2); // true
   * ```
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
      keyspace: options?.keyspace,
    });
  }

  public async dropTableIndex(name: string, options?: TableDropIndexOptions): Promise<void> {
    await this.#httpClient.executeCommand({ dropIndex: { name, options: { ifExists: options?.ifExists } } }, {
      timeoutManager: this.#httpClient.tm.single('tableAdminTimeoutMs', options),
    });
  }

  /**
   * Lists the collection names in the database.
   *
   * If you want to include the collection options in the response, set `nameOnly` to `false` (or omit it completely),
   * using the other overload.
   *
   * You can also specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
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
   *
   * @see CollectionOptions
   */
  public async listCollections(options: ListCollectionsOptions & { nameOnly: true }): Promise<string[]>

  /**
   * Lists the collections in the database.
   *
   * If you want to use only the collection names, set `nameOnly` to `true`, using the other overload.
   *
   * You can also specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
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
   *
   * @see CollectionOptions
   */
  public async listCollections(options?: ListCollectionsOptions & { nameOnly?: false }): Promise<FullCollectionInfo[]>

  public async listCollections(options?: ListCollectionsOptions): Promise<string[] | FullCollectionInfo[]> {
    const command = {
      findCollections: {
        options: {
          explain: options?.nameOnly !== true,
        },
      },
    };

    const resp = await this.#httpClient.executeCommand(command, {
      timeoutManager: this.#httpClient.tm.single('collectionAdminTimeoutMs', options),
      keyspace: options?.keyspace,
    });
    return resp.status!.collections;
  }

  /**
   * Lists the table names in the database.
   *
   * If you want to include the table options in the response, set `nameOnly` to `false` (or omit it completely),
   * using the other overload.
   *
   * You can also specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
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
   *
   * @see CollectionOptions
   */
  public async listTables(options: ListTablesOptions & { nameOnly: true }): Promise<string[]>

  /**
   * Lists the tables in the database.
   *
   * If you want to use only the table names, set `nameOnly` to `true`, using the other overload.
   *
   * You can also specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
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
   *
   * @see CollectionOptions
   */
  public async listTables(options?: ListTablesOptions & { nameOnly?: false }): Promise<FullTableInfo[]>

  public async listTables(options?: ListTablesOptions): Promise<string[] | FullTableInfo[]> {
    const command = {
      listTables: {
        options: {
          explain: options?.nameOnly !== true,
        },
      },
    };

    const resp = await this.#httpClient.executeCommand(command, {
      timeoutManager: this.#httpClient.tm.single('tableAdminTimeoutMs', options),
      keyspace: options?.keyspace,
    });
    return resp.status!.tables;
  }

  /**
   * Send a POST request to the Data API for this database with an arbitrary, caller-provided payload.
   *
   * You can specify a table/collection to target in the options parameter, thereby allowing you to perform
   * arbitrary table/collection-level operations as well.
   *
   * If the keyspace is set to `null`, the command will be run at the database level.
   *
   * If no collection is specified, the command will be executed at the keyspace level.
   *
   * You can also specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
   * instance.
   *
   * @example
   * ```typescript
   * const colls = await db.command({ findCollections: {} });
   * console.log(colls); // { status: { collections: [] } }
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
    if (options?.collection && options.table) {
      throw new Error('Can\'t provide both `table` and `collection` as options to db.command()');
    }

    return await this.#httpClient.executeCommand(command, {
      timeoutManager: this.#httpClient.tm.single('generalMethodTimeoutMs', options),
      collection: options?.collection ?? options?.table,
      keyspace: options?.keyspace,
    });
  }

  public get _httpClient() {
    return this.#httpClient;
  }
}
