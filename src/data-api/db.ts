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

import {
  Collection,
  CollectionAlreadyExistsError,
  DbSpawnOptions,
  EmbeddingHeadersProvider,
  SomeDoc,
} from '@/src/data-api';
import {
  DataAPIHttpClient,
  DEFAULT_DATA_API_PATHS,
  DEFAULT_KEYSPACE,
  EmissionStrategy, KeyspaceRef,
  RawDataAPIResponse,
} from '@/src/api';
import {
  CreateCollectionOptions,
  FullCollectionInfo,
  ListCollectionsOptions,
  WithKeyspace,
} from '@/src/data-api/types';
import { DatabaseInfo } from '@/src/devops/types/admin/database-info';
import { AstraDbAdmin } from '@/src/devops/astra-db-admin';
import { RunCommandOptions } from '@/src/data-api/types/collections/command';
import { DataAPIEnvironment, nullish, WithTimeout } from '@/src/common/types';
import { DropCollectionOptions } from '@/src/data-api/types/collections/drop-collection';
import { extractDbIdFromUrl, validateOption } from '@/src/data-api/utils';
import { CreateCollectionCommand } from '@/src/data-api/types/collections/create-collection';
import { ListCollectionsCommand } from '@/src/data-api/types/collections/list-collection';
import { InternalRootClientOpts } from '@/src/client/types';
import { CollectionSpawnOptions } from '@/src/data-api/types/collections/spawn-collection';
import { AdminSpawnOptions, DbAdmin } from '@/src/devops';
import { resolveKeyspace, TokenProvider, validateDataAPIEnv } from '@/src/common';
import { DataAPIDbAdmin } from '@/src/devops/data-api-db-admin';

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
  readonly #token: TokenProvider;
  readonly #httpClient: DataAPIHttpClient;
  readonly #endpoint?: string;

  private readonly _keyspace: KeyspaceRef;
  private readonly _id?: string;

  /**
   * Use {@link DataAPIClient.db} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(endpoint: string, rootOpts: InternalRootClientOpts, dbOpts: DbSpawnOptions | nullish) {
    this.#defaultOpts = rootOpts;

    this.#token = TokenProvider.parseToken(dbOpts?.token ?? rootOpts.dbOptions.token);

    const combinedDbOpts = {
      ...rootOpts.dbOptions,
      ...dbOpts,
    };

    this._keyspace = {
      ref: (rootOpts.environment === 'astra')
        ? resolveKeyspace(combinedDbOpts) ?? DEFAULT_KEYSPACE
        : resolveKeyspace(combinedDbOpts),
    };

    this.#httpClient = new DataAPIHttpClient({
      baseUrl: endpoint,
      tokenProvider: this.#token,
      embeddingHeaders: EmbeddingHeadersProvider.parseHeaders(null),
      baseApiPath: combinedDbOpts.dataApiPath || DEFAULT_DATA_API_PATHS[rootOpts.environment],
      emitter: rootOpts.emitter,
      monitorCommands: combinedDbOpts.monitorCommands,
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
   * The default keyspace to use for all operations in this database, unless overridden in a method call.
   *
   * This is now a deprecated alias for the strictly equivalent {@link Db.keyspace}, and will be removed
   * in an upcoming major version.
   *
   * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
   *
   * @deprecated - Prefer {@link Db.keyspace} instead.
   */
  public get namespace(): string {
    if (!this._keyspace.ref) {
      throw new Error('No keyspace set for DB (can\'t do db.namespace, or perform any operation requiring it). Use `db.useKeyspace`, or pass the keyspace as an option parameter explicitly.');
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
   * Sets the default working keyspace of the `Db` instance. Does not retroactively update any previous collections
   * spawned from this `Db` to use the new keyspace.
   *
   * This is now a deprecated alias for the strictly equivalent {@link Db.useKeyspace}, and will be removed
   * in an upcoming major version.
   *
   * https://docs.datastax.com/en/astra-db-serverless/api-reference/client-versions.html#version-1-5
   *
   * @deprecated - Prefer {@link Db.useKeyspace} instead.
   */
  public useNamespace(keyspace: string) {
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
      return new AstraDbAdmin(this, this.#defaultOpts, options, this.#token, this.#endpoint!);
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
   * You can also specify a keyspace in the options parameter, which will override the default keyspace for this database.
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

  /**
   * Establishes references to all the collections in the working/given keyspace.
   *
   * You can specify a keyspace in the options parameter, which will override the default keyspace for this `Db` instance.
   *
   * @example
   * ```typescript
   * // Uses db's default keyspace
   * const collections1 = await db.collections();
   * console.log(collections1); // [Collection<SomeDoc>, Collection<SomeDoc>]
   *
   * // Overrides db's default keyspace
   * const collections2 = await db.collections({ keyspace: 'my_keyspace' });
   * console.log(collections2); // [Collection<SomeDoc>]
   * ```
   *
   * @param options - Options for this operation.
   *
   * @returns A promise that resolves to an array of references to the working Db's collections.
   *
   * @deprecated - Essentially equivalent to `(await db.listCollections()).map(c => new Collection(c.name))`; will be
   * removed in an upcoming major release.
   */
  public async collections(options?: WithKeyspace & WithTimeout): Promise<Collection[]> {
    const collections = await this.listCollections({
      keyspace: resolveKeyspace(options),
      maxTimeMS: options?.maxTimeMS,
      nameOnly: true,
    });

    return collections.map(c => this.collection(c, options));
  }

  /**
   * Creates a new collection in the database, and establishes a reference to it.
   *
   * **NB. You are limited in the amount of collections you can create, so be wary when using this command.**
   *
   * This is a blocking command which performs actual I/O unlike {@link Db.collection}, which simply creates an
   * unvalidated reference to a collection.
   *
   * If `checkExists: false`, creation is idempotent, so if the collection already exists with the same options,
   * this method will not throw an error. If the options mismatch, it will throw a {@link DataAPIResponseError}.
   *
   * Typed as `Collection<SomeDoc>` by default, but you can specify a schema type to get a typed collection. If left
   * as `SomeDoc`, the collection will be untyped.
   *
   * *If vector options are not specified, the collection will not support vector search.*
   *
   * You can also specify a keyspace in the options parameter, which will override the default keyspace for this database.
   *
   * See {@link CreateCollectionOptions} for *much* more information on the options available.
   *
   * @example
   * ```typescript
   * interface User {
   *   name: string,
   *   age?: number,
   * }
   *
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
   * @see VectorDoc
   */
  public async createCollection<Schema extends SomeDoc = SomeDoc>(collectionName: string, options?: CreateCollectionOptions<Schema>): Promise<Collection<Schema>> {
    const command: CreateCollectionCommand = {
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
    const keyspace = resolveKeyspace(options) ?? this.keyspace;

    if (options?.checkExists !== false) {
      const collections = await this.listCollections({ keyspace: keyspace, maxTimeMS: timeoutManager.msRemaining() });

      if (collections.some(c => c.name === collectionName)) {
        throw new CollectionAlreadyExistsError(resolveKeyspace(options) ?? this.keyspace, collectionName);
      }
    }

    await this.#httpClient.executeCommand(command, { keyspace: keyspace, timeoutManager });
    return this.collection(collectionName, options);
  }

  /**
   * Drops a collection from the database, including all the contained documents.
   *
   * You can also specify a keyspace in the options parameter, which will override the default keyspace for this database.
   *
   * @example
   * ```typescript
   * // Uses db's default keyspace
   * const success1 = await db.dropCollection("users");
   * console.log(success1); // true
   *
   * // Overrides db's default keyspace
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
   * Lists the collection names in the database.
   *
   * If you want to include the collection options in the response, set `nameOnly` to `false`, using the other overload.
   *
   * You can also specify a keyspace in the options parameter, which will override the default keyspace for this database.
   *
   * @example
   * ```typescript
   * // [{ name: "users" }, { name: "posts" }]
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
   * If you want to use only the collection names, set `nameOnly` to `true` (or omit it completely), using the other overload.
   *
   * You can also specify a keyspace in the options parameter, which will override the default keyspace for this database.
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
    const command: ListCollectionsCommand = {
      findCollections: {
        options: {
          /* Is 'nameOnly' instead of 'explain' for Mongo-compatibility reasons */
          explain: options?.nameOnly !== true,
        },
      },
    };

    const resp = await this.#httpClient.executeCommand(command, options);
    return resp.status!.collections;
  }

  /**
   * Send a POST request to the Data API for this database with an arbitrary, caller-provided payload.
   *
   * You can specify a collection to target in the options parameter, thereby allowing you to perform
   * arbitrary collection-level operations as well.
   *
   * You're also able to specify a keyspace in the options parameter, which will override the default keyspace
   * for this database.
   *
   * If no collection is specified, the command will be executed at the database level.
   *
   * @example
   * ```typescript
   * const colls = await db.command({ findCollections: {} });
   * console.log(colls); // { status: { collections: [] } }
   *
   * const users = await db.command({ findOne: {} }, { collection: 'users' });
   * console.log(users); // { data: { document: null } }
   * ```
   *
   * @param command - The command to send to the Data API.
   * @param options - Options for this operation.
   *
   * @returns A promise that resolves to the raw response from the Data API.
   */
  public async command(command: Record<string, any>, options?: RunCommandOptions): Promise<RawDataAPIResponse> {
    return await this.#httpClient.executeCommand(command, options);
  }

  private get _httpClient() {
    return this.#httpClient;
  }
}

/**
 * @internal
 */
export function mkDb(rootOpts: InternalRootClientOpts, endpointOrId: string, regionOrOptions: string | DbSpawnOptions | nullish, maybeOptions: DbSpawnOptions | nullish) {
  const dbOpts = (typeof regionOrOptions === 'string')
    ? maybeOptions
    : regionOrOptions;

  validateDbOpts(dbOpts);

  if (typeof regionOrOptions === 'string' && (endpointOrId.startsWith('https://') || endpointOrId.startsWith('http://'))) {
    throw new Error('Unexpected db() argument: database id can\'t start with "http(s)://". Did you mean to call `.db(endpoint, { keyspace })`?');
  }

  const endpoint = (typeof regionOrOptions === 'string')
    ? 'https://' + endpointOrId + '-' + regionOrOptions + '.apps.astra.datastax.com'
    : endpointOrId;

  return new Db(endpoint, rootOpts, dbOpts);
}

/**
 * @internal
 */
export function validateDbOpts(opts: DbSpawnOptions | nullish) {
  validateOption('dbOptions', opts, 'object');

  if (!opts) {
    return;
  }

  for (const prop of <const>['keyspace', 'namespace']) {
    validateOption(`dbOptions.${prop}`, opts[prop], 'string', false, (keyspace) => {
      if (!keyspace.match(/^\w{1,48}$/)) {
        throw new Error(`Invalid ${prop} option; expected a string of 1-48 alphanumeric characters`);
      }
    });
  }

  validateOption('dbOptions.monitorCommands', opts.monitorCommands, 'boolean');

  validateOption('dbOptions.dataApiPath', opts.dataApiPath, 'string');
}
