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
import { DEFAULT_KEYSPACE, RawDataAPIResponse } from '@/src/lib/api';
import { DatabaseInfo } from '@/src/administration/types/admin/database-info';
import { AstraDbAdmin } from '@/src/administration/astra-db-admin';
import { DataAPIEnvironment, nullish, WithTimeout } from '@/src/lib/types';
import { extractDbIdFromUrl } from '@/src/documents/utils';
import { AdminSpawnOptions, DbAdmin } from '@/src/administration';
import { DataAPIDbAdmin } from '@/src/administration/data-api-db-admin';
import { CollectionAlreadyExistsError, TableAlreadyExistsError } from '@/src/db/errors';
import { CreateCollectionOptions } from '@/src/db/types/collections/create-collection';
import { TokenProvider } from '@/src/lib';
import { DataAPIHttpClient, EmissionStrategy } from '@/src/lib/api/clients/data-api-http-client';
import { KeyspaceRef } from '@/src/lib/api/clients/types';
import { validateDataAPIEnv } from '@/src/lib/utils';
import { EmbeddingHeadersProvider, SomeRow, Table } from '@/src/documents';
import { DEFAULT_DATA_API_PATHS } from '@/src/lib/api/constants';
import { CollectionSpawnOptions } from '@/src/db/types/collections/spawn-collection';
import { DropCollectionOptions } from '@/src/db/types/collections/drop-collection';
import { FullCollectionInfo, ListCollectionsOptions } from '@/src/db/types/collections/list-collections';
import { RunCommandOptions } from '@/src/db/types/command';
import { TableSpawnOptions } from '@/src/db/types/tables/spawn-table';
import { CreateTableDefinition, CreateTableOptions } from '@/src/db/types/tables/create-table';
import { InferTableSchemaFromDefinition } from '@/src/db/types/tables/table-schema';
import { DropTableOptions } from '@/src/db/types/tables/drop-table';
import { FullTableInfo, ListTablesOptions } from '@/src/db/types/tables/list-tables';
import { parseDbSpawnOpts } from '@/src/client/parsers/spawn-db';
import { DbSpawnOptions } from '@/src/client/types';
import { InternalRootClientOpts } from '@/src/client/types/internal';
import { Logger } from '@/src/lib/logging/logger';

/**
 * Represents an interface to some Astra database instance. This is the entrypoint for database-level DML, such as
 * creating/deleting collections, connecting to collections, and executing arbitrary commands.
 *
 * **Shouldn't be instantiated directly; use {@link DataAPIClient.db} to obtain an instance of this class.**
 *
 * Note that creating an instance of a `Db` doesn't trigger actual database creation; the database must have already
 * existed beforehand. If you need to create a new database, use the {@link AstraAdmin} class.
 *
 * Db spawning methods let you pass in the default keyspace for the database, which is used for all subsequent db
 * operations in that object, but each method lets you override the keyspace if necessary in its options.
 *
 * @example
 * ```typescript
 * const client = new DataAPIClient('AstraCS:...');
 *
 * // Connect to a database using a direct endpoint
 * const db1 = client.db('https://<db_id>-<region>.apps.astra.datastax.com');
 *
 * // Overrides default options from the DataAPIClient
 * const db2 = client.db('https://<db_id>-<region>.apps.astra.datastax.com', {
 *   keyspace: 'my_keyspace',
 *   useHttp2: false,
 * });
 *
 * // Lets you connect using a database ID and region
 * const db3 = client.db('a6a1d8d6-31bc-4af8-be57-377566f345bf', 'us-east1');
 * ```
 *
 * @see DataAPIClient.db
 * @see AstraAdmin.db
 *
 * @public
 */
export class Db {
  readonly #defaultOpts: InternalRootClientOpts;
  readonly #httpClient: DataAPIHttpClient;
  readonly #endpoint?: string;

  private readonly _keyspace: KeyspaceRef;
  private readonly _id?: string;

  /**
   * Use {@link DataAPIClient.db} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(rootOpts: InternalRootClientOpts, endpoint: string, rawDbOpts: DbSpawnOptions | nullish) {
    const dbOpts = parseDbSpawnOpts(rawDbOpts, 'options');

    const token = TokenProvider.parseToken([dbOpts?.token, rootOpts.dbOptions.token], 'token');

    this.#defaultOpts = {
      ...rootOpts,
      dbOptions: {
        keyspace: dbOpts?.keyspace ?? rootOpts.dbOptions.keyspace,
        dataApiPath: dbOpts?.dataApiPath ?? rootOpts.dbOptions.dataApiPath,
        token: token,
        logging: Logger.advanceConfig(rootOpts.dbOptions.logging, dbOpts?.logging),
      },
      adminOptions: {
        ...rootOpts.adminOptions,
        adminToken: TokenProvider.parseToken([rootOpts.adminOptions.adminToken, token], 'token'),
      },
    };

    this._keyspace = {
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
      keyspace: this._keyspace,
      userAgent: rootOpts.userAgent,
      emissionStrategy: EmissionStrategy.Normal,
    });

    this._id = extractDbIdFromUrl(endpoint);
    this.#endpoint = endpoint;
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
    if (!this._keyspace.ref) {
      throw new Error('No keyspace set for DB (can\'t do db.keyspace, or perform any operation requiring it). Use `db.useKeyspace`, or pass the keyspace as an option parameter explicitly.');
    }
    return this._keyspace.ref;
  }

  /**
   * The ID of the database, if it's an Astra database. If it's not an Astra database, this will throw an error.
   *
   * @throws Error - if the database is not an Astra database.
   */
  public get id(): string {
    if (!this._id) {
      throw new Error('Non-Astra databases do not have an appropriate ID');
    }
    return this._id;
  }

  /**
   * Sets the default working keyspace of the `Db` instance. Does not retroactively update any previous collections
   * spawned from this `Db` to use the new keyspace.
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
   * @example
   * ```typescript
   * // If using non-astra, this may be a common idiom:
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
    this._keyspace.ref = keyspace;
  }

  /**
   * Spawns a new {@link AstraDbAdmin} instance for this database, used for performing administrative operations
   * on the database, such as managing keyspaces, or getting database information.
   *
   * The given options will override any default options set when creating the {@link DataAPIClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
   *
   * **If using a non-Astra backend, the `environment` option MUST be set as it is on the `DataAPIClient`**
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
   * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
   *
   * @returns A new {@link AstraDbAdmin} instance for this database instance.
   *
   * @throws Error - if the database is not an Astra database.
   */
  public admin(options?: AdminSpawnOptions & { environment?: 'astra' }): AstraDbAdmin

  /**
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
   * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
   *
   * @returns A new {@link AstraDbAdmin} instance for this database instance.
   *
   * @throws Error - if the database is not an Astra database.
   */
  public admin(options: AdminSpawnOptions & { environment: Exclude<DataAPIEnvironment, 'astra'> }): DataAPIDbAdmin

  public admin(options?: AdminSpawnOptions & { environment?: DataAPIEnvironment }): DbAdmin {
    const environment = options?.environment ?? 'astra';

    validateDataAPIEnv(environment);

    if (this.#defaultOpts.environment !== environment) {
      throw new Error('Mismatching environment—environment option is not the same as set in the DataAPIClient');
    }

    if (environment === 'astra') {
      return new AstraDbAdmin(this, this.#defaultOpts, options, this.#defaultOpts.dbOptions.token, this.#endpoint!);
    }

    return new DataAPIDbAdmin(this, this.#httpClient, options);
  }

  /**
   * Fetches information about the database, such as the database name, region, and other metadata.
   *
   * **NB. Only available for Astra databases.**
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
   * @returns A promise that resolves to the database information.
   *
   * @throws Error - if the database is not an Astra database.
   */
  public async info(options?: WithTimeout): Promise<DatabaseInfo> {
    return await this.admin().info(options).then(i => i.info);
  }

  /**
   * Establishes a reference to a collection in the database. This method does not perform any I/O.
   *
   * **NB. This method does not validate the existence of the collection—it simply creates a reference.**
   *
   * **Unlike the MongoDB driver, this method does not create a collection if it doesn't exist.**
   *
   * Use {@link Db.createCollection} to create a new collection instead.
   *
   * Typed as `Collection<SomeDoc>` by default, but you can specify a schema type to get a typed collection. If left
   * as `SomeDoc`, the collection will be untyped.
   *
   * You can also specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
   * instance.
   *
   * @example
   * ```typescript
   * interface User {
   *   name: string,
   *   age?: number,
   * }
   *
   * const users1 = db.collection<User>("users");
   * users1.insertOne({ name: "John" });
   *
   * // Untyped collection from different keyspace
   * const users2 = db.collection("users", {
   *   keyspace: "my_keyspace",
   * });
   * users2.insertOne({ nam3: "John" });
   * ```
   *
   * @param name - The name of the collection.
   * @param options - Options for the connection.
   *
   * @returns A new, unvalidated, reference to the collection.
   *
   * @see SomeDoc
   * @see VectorDoc
   */
  public collection<Schema extends SomeDoc = SomeDoc>(name: string, options?: CollectionSpawnOptions): Collection<Schema> {
    return new Collection<Schema>(this, this.#httpClient, name, options);
  }

  public table<Schema extends SomeRow = SomeRow>(name: string, options?: TableSpawnOptions): Table<Schema> {
    return new Table<Schema>(this, this.#httpClient, name, options);
  }

  /**
   * Creates a new collection in the database, and establishes a reference to it.
   *
   * **NB. You are limited in the amount of collections you can create, so be wary when using this command.**
   *
   * This is a *blocking* command which performs actual I/O (unlike {@link Db.collection}, which simply creates an
   * unvalidated reference to a collection).
   *
   * If `checkExists: false`, collection creation is idempotent—if the collection already exists with the same options,
   * this method will not throw an error. If the options mismatch, it will throw a {@link DataAPIResponseError}.
   *
   * *If vector options are not specified, the collection will not support vector search.*
   *
   * You can also specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
   * instance.
   *
   * See {@link CreateCollectionOptions} for *much* more information on the options available.
   *
   * By default, the object is typed as `Collection<SomeDoc>`, but you can specify a schema type to get a typed collection.
   * If left as `SomeDoc`, the collection will be effectively untyped/dynamic in schema.
   *
   * @example
   * ```typescript
   * interface User {
   *   name: string,
   *   age?: number,
   * }
   *
   * // Typed collection created in the Db's working keyspace
   * const users = await db.createCollection<User>("users");
   * users.insertOne({ name: "John" });
   *
   * // Untyped collection with custom options in a different keyspace
   * const users2 = await db.createCollection("users", {
   *   keyspace: "my_keyspace",
   *   defaultId: {
   *     type: "objectId",
   *   },
   *   checkExists: false,
   * });
   * ```
   *
   * @param collectionName - The name of the collection to create.
   * @param options - Options for the collection.
   *
   * @returns A promised reference to the newly created collection.
   *
   * @throws CollectionAlreadyExistsError - if the collection already exists and `checkExists` is `true` or unset.
   *
   * @see SomeDoc
   * @see db.collection
   */
  public async createCollection<Schema extends SomeDoc = SomeDoc>(collectionName: string, options?: CreateCollectionOptions<Schema>): Promise<Collection<Schema>> {
    const command = {
      createCollection: {
        name: collectionName,
        options: {
          defaultId: options?.defaultId,
          indexing: options?.indexing as any,
          vector: options?.vector,
        },
      },
    };

    const timeoutManager = this.#httpClient.timeoutManager(options?.maxTimeMS);
    const keyspace = options?.keyspace ?? this.keyspace;

    if (options?.checkExists !== false) {
      const collections = await this.listCollections({ keyspace, maxTimeMS: timeoutManager.msRemaining() });

      if (collections.some(c => c.name === collectionName)) {
        throw new CollectionAlreadyExistsError(keyspace, collectionName);
      }
    }

    await this.#httpClient.executeCommand(command, { keyspace, timeoutManager });
    return this.collection(collectionName, options);
  }

  /**
   * Creates a new table in the database, and establishes a reference to it.
   *
   * **NB. You are limited in the amount of tables you can create, so be wary when using this command.**
   *
   * This is a *blocking* command which performs actual I/O (unlike {@link Db.table}, which simply creates an
   * unvalidated reference to a table).
   *
   * If `checkExists: false`, table creation is idempotent—if the table already exists with the same options,
   * this method will not throw an error. If the options mismatch, it will throw a {@link DataAPIResponseError}.
   *
   * You can also specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
   * instance.
   *
   * See {@link CreateTableOptions} for *much* more information on the options available.
   *
   * This version of {@link Db.createTable} infers the schema of the table using the provided bespoke table definition.
   *
   * This behaviour may be extremely convenient, but in case you'd like to manually provide your own schema, leave
   * the table as untyped, or save some typechecking power, you may provide a generic type parameter to the method
   * explicitly (e.g. `db.createTable<SomeRow>(...)`).
   *
   * See {@link InferTableSchema} for more info.
   *
   * @example
   * ```typescript
   * // Function to create the actual table
   * const mkUserTable = () => db.createTable('users', {
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
   *       partitionBy: ['name', 'height'],
   *       partitionSort: { dob: 1 },
   *     },
   *   },
   * });
   *
   * // Type inference is as simple as that
   * type User = InferTableSchema<typeof mkUserTable>;
   *
   * // And now `User` can be used wherever.
   * const main = async () => {
   *   const table: Table<User> = await mkUserTable();
   *   const found: User | null = await table.findOne({});
   * };
   * ```
   *
   * @param tableName - The name of the collection to create.
   * @param options - Options for the collection.
   *
   * @returns A promised reference to the newly created table.
   *
   * @throws TableAlreadyExistsError - if the table already exists and `checkExists` is `true` or unset.
   *
   * @see SomeRow
   * @see db.table
   */
  public async createTable<const Def extends CreateTableDefinition>(tableName: string, options: CreateTableOptions<Def>): Promise<Table<InferTableSchemaFromDefinition<Def>>>

  /**
   * Creates a new table in the database, and establishes a reference to it.
   *
   * **NB. You are limited in the amount of tables you can create, so be wary when using this command.**
   *
   * This is a *blocking* command which performs actual I/O (unlike {@link Db.table}, which simply creates an
   * unvalidated reference to a table).
   *
   * If `checkExists: false`, table creation is idempotent—if the table already exists with the same options,
   * this method will not throw an error. If the options mismatch, it will throw a {@link DataAPIResponseError}.
   *
   * You can also specify a keyspace in the options parameter, which will override the working keyspace for this `Db`
   * instance.
   *
   * See {@link CreateTableOptions} for *much* more information on the options available.
   *
   * This version of {@link Db.createTable} takes in an explicit type for the table schema. Use {@link SomeRow} as the
   * type if you just want a dynamically typed `Table` (e.g. `db.createTable<SomeRow>(...)`).
   *
   * Explicit schema types should extend `Row` so the primary key type may be automatically inferred for insertion
   * results. See {@link Row} for more info.
   *
   * **NB. It is on the user to ensure that the provided type param properly corresponds with the actual schema of the
   * table in its TS-deserialized form. See the other variant of {@link Db.createTable} for automatically inferring
   * the type of the table's schema.**
   *
   * @example
   * ```typescript
   * // TS type corresponding to the table's schema
   * // The `Row` type automagically creates the primary key schema type for insertion results
   * interface User extends Row<User, 'name' | 'dob'> {
   *   name: string,
   *   dob: CqlDate,
   *   friends?: Set<string>,
   * }
   *
   * // Use the actual table
   * const main = async () => {
   *   const user = await db.createTable<User>('users', {
   *     definition: {
   *       columns: {
   *         name: 'text',
   *         dob: {
   *           type: 'timestamp',
   *         },
   *         friends: {
   *           type: 'set',
   *           valueType: 'text',
   *         },
   *       },
   *       primaryKey: {
   *         partitionBy: ['name'],
   *         partitionSort: { dob: 1 },
   *       },
   *     },
   *   });
   *   const found: User | null = await table.findOne({});
   * };
   * ```
   *
   * @param tableName - The name of the collection to create.
   * @param options - Options for the collection.
   *
   * @returns A promised reference to the newly created table.
   *
   * @throws TableAlreadyExistsError - if the table already exists and `checkExists` is `true` or unset.
   *
   * @see SomeRow
   * @see db.table
   */
  public async createTable<Schema extends SomeRow>(tableName: string, options: CreateTableOptions): Promise<Table<Schema>>

  public async createTable(tableName: string, options: CreateTableOptions): Promise<Table> {
    const command = {
      createTable: {
        name: tableName,
        definition: options.definition,
      },
    };

    const timeoutManager = this.#httpClient.timeoutManager(options?.maxTimeMS);
    const keyspace = options?.keyspace ?? this.keyspace;

    if (options?.checkExists !== false) {
      const tables = await this.listTables({ keyspace, maxTimeMS: timeoutManager.msRemaining() });

      if (tables.some(c => c.name === tableName)) {
        throw new TableAlreadyExistsError(keyspace, tableName);
      }
    }

    await this.#httpClient.executeCommand(command, { keyspace, timeoutManager });
    return this.table(tableName, options);
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
   * const success1 = await db.dropCollection("users");
   * console.log(success1); // true
   *
   * // Overrides db's working keyspace
   * const success2 = await db.dropCollection("users", {
   *   keyspace: "my_keyspace"
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
  public async dropCollection(name: string, options?: DropCollectionOptions): Promise<boolean> {
    const command = {
      deleteCollection: { name },
    };

    const resp = await this.#httpClient.executeCommand(command, options);

    return resp.status?.ok === 1;
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
   * const success1 = await db.dropTable("users");
   * console.log(success1); // true
   *
   * // Overrides db's working keyspace
   * const success2 = await db.dropTable("users", {
   *   keyspace: "my_keyspace"
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
  public async dropTable(name: string, options?: DropTableOptions): Promise<boolean> {
    const command = {
      dropTable: { name },
    };

    const resp = await this.#httpClient.executeCommand(command, options);

    return resp.status?.ok === 1;
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
   * // [{ name: "users" }, { name: "posts", options: { ... } }]
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

    const resp = await this.#httpClient.executeCommand(command, options);
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
   * // [{ name: "users" }, { name: "posts", definition: { ... } }]
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
      findTables: {
        options: {
          explain: options?.nameOnly !== true,
        },
      },
    };

    const resp = await this.#httpClient.executeCommand(command, options);
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
      keyspace: options?.keyspace,
      collection: options?.collection ?? options?.table,
      maxTimeMS: options?.maxTimeMS,
    });
  }

  public get _httpClient() {
    return this.#httpClient;
  }
}
