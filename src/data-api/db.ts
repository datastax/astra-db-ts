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

import { Collection, CollectionAlreadyExistsError, DbSpawnOptions, SomeDoc } from '@/src/data-api';
import { DataAPIHttpClient, DEFAULT_DATA_API_PATH, DEFAULT_NAMESPACE, RawDataAPIResponse } from '@/src/api';
import {
  CreateCollectionOptions,
  FullCollectionInfo,
  ListCollectionsOptions,
  WithNamespace,
} from '@/src/data-api/types';
import { DatabaseInfo } from '@/src/devops/types/admin/database-info';
import { AstraDbAdmin, mkDbAdmin } from '@/src/devops/astra-db-admin';
import { RunCommandOptions } from '@/src/data-api/types/collections/command';
import { WithTimeout } from '@/src/common/types';
import { DropCollectionOptions } from '@/src/data-api/types/collections/drop-collection';
import { extractDbIdFromUrl, validateOption } from '@/src/data-api/utils';
import { CreateCollectionCommand } from '@/src/data-api/types/collections/create-collection';
import { ListCollectionsCommand } from '@/src/data-api/types/collections/list-collection';
import { InternalRootClientOpts } from '@/src/client/types';
import { CollectionSpawnOptions } from '@/src/data-api/types/collections/spawn-collection';
import { AdminSpawnOptions } from '@/src/devops';
import { TokenProvider } from '@/src/common';

/**
 * Represents an interface to some Astra database instance. This is the entrypoint for database-level DML, such as
 * creating/deleting collections, connecting to collections, and executing arbitrary commands.
 *
 * **Shouldn't be instantiated directly; use {@link DataAPIClient.db} to obtain an instance of this class.**
 *
 * Note that creating an instance of a `Db` doesn't trigger actual database creation; the database must have already
 * existed beforehand. If you need to create a new database, use the {@link AstraAdmin} class.
 *
 * Db spawning methods let you pass in the default namespace for the database, which is used for all subsequent db
 * operations in that object, but each method lets you override the namespace if necessary in its options.
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
 *   namespace: 'my_namespace',
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
  readonly #defaultOpts!: InternalRootClientOpts;

  private readonly _httpClient!: DataAPIHttpClient;
  private readonly _id?: string;

  /**
   * The default namespace to use for all operations in this database, unless overridden in a method call.
   *
   * @example
   * ```typescript
   *
   * // Uses 'default_keyspace' as the default namespace for all future db spawns
   * const client1 = new DataAPIClient('*TOKEN*');
   *
   * // Overrides the default namespace for all future db spawns
   * const client2 = new DataAPIClient('*TOKEN*', {
   *   dbOptions: { namespace: 'my_namespace' }
   * });
   *
   * // Created with 'default_keyspace' as the default namespace
   * const db1 = client1.db('*ENDPOINT*');
   *
   * // Created with 'my_namespace' as the default namespace
   * const db2 = client1.db('*ENDPOINT*', {
   *   namespace: 'my_namespace'
   * });
   *
   * // Uses 'default_keyspace'
   * const coll1 = db1.collection('users');
   *
   * // Uses 'my_namespace'
   * const coll2 = db1.collection('users', {
   *   namespace: 'my_namespace'
   * });
   * ```
   */
  public readonly namespace!: string;

  /**
   * Use {@link DataAPIClient.db} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(endpoint: string, options: InternalRootClientOpts) {
    const dbOpts = options.dbOptions;

    Object.defineProperty(this, 'namespace', {
      value: dbOpts.namespace ?? DEFAULT_NAMESPACE,
      writable: false,
    });

    this.#defaultOpts = options;

    Object.defineProperty(this, '_httpClient', {
      value: new DataAPIHttpClient({
        baseUrl: endpoint,
        applicationToken: dbOpts.token,
        baseApiPath: dbOpts.dataApiPath || DEFAULT_DATA_API_PATH,
        emitter: options.emitter,
        monitorCommands: dbOpts.monitorCommands,
        fetchCtx: options.fetchCtx,
        namespace: this.namespace,
        userAgent: options.userAgent,
      }),
      enumerable: false,
    });

    Object.defineProperty(this, '_id', {
      value: extractDbIdFromUrl(endpoint),
      enumerable: false,
    });
  }

  /**
   * The ID of the database, if it's an Astra database. If it's not an Astra database, this will throw an error.
   *
   * @throws Error - if the database is not an Astra database.
   */
  get id(): string {
    if (!this._id) {
      throw new Error('Non-Astra databases do not have an appropriate ID');
    }
    return this._id;
  }

  /**
   * Spawns a new {@link AstraDbAdmin} instance for this database, used for performing administrative operations
   * on the database, such as managing namespaces, or getting database information.
   *
   * **NB. Only available for Astra databases.**
   *
   * The given options will override any default options set when creating the {@link DataAPIClient} through
   * a deep merge (i.e. unset properties in the options object will just default to the default options).
   *
   * @example
   * ```typescript
   * const admin1 = db.admin();
   * const admin2 = db.admin({ adminToken: '<stronger-token>' });
   *
   * const namespaces = await admin1.listNamespaces();
   * console.log(namespaces);
   * ```
   *
   * @param options - Any options to override the default options set when creating the {@link DataAPIClient}.
   *
   * @returns A new {@link AstraDbAdmin} instance for this database instance.
   *
   * @throws Error - if the database is not an Astra database.
   */
  public admin(options?: AdminSpawnOptions): AstraDbAdmin {
    if (!this._id) {
      throw new Error('Admin operations are only supported on Astra databases');
    }
    return mkDbAdmin(this, this.#defaultOpts, options);
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
   * You can also specify a namespace in the options parameter, which will override the default namespace for this database.
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
   * // Untyped collection from different namespace
   * const users2 = db.collection("users", {
   *   namespace: "my_namespace"
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
    return new Collection<Schema>(this, this._httpClient, name, options);
  }

  /**
   * Establishes references to all the collections in the working/given namespace.
   *
   * You can specify a namespace in the options parameter, which will override the default namespace for this `Db` instance.
   *
   * @example
   * ```typescript
   * // Uses db's default namespace
   * const collections1 = await db.collections();
   * console.log(collections1); // [Collection<SomeDoc>, Collection<SomeDoc>]
   *
   * // Overrides db's default namespace
   * const collections2 = await db.collections({ namespace: 'my_namespace' });
   * console.log(collections2); // [Collection<SomeDoc>]
   * ```
   *
   * @param options - Options for this operation.
   *
   * @returns A promise that resolves to an array of references to the working Db's collections.
   */
  public async collections(options?: WithNamespace & WithTimeout): Promise<Collection[]> {
    const collections = await this.listCollections({
      namespace: options?.namespace,
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
   * You can also specify a namespace in the options parameter, which will override the default namespace for this database.
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
   * // Untyped collection with custom options in a different namespace
   * const users2 = await db.createCollection("users", {
   *   namespace: "my_namespace",
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

    const timeoutManager = this._httpClient.timeoutManager(options?.maxTimeMS);
    const namespace = options?.namespace ?? this.namespace;

    if (options?.checkExists !== false) {
      const collections = await this.listCollections({ namespace, maxTimeMS: timeoutManager.msRemaining() });

      if (collections.some(c => c.name === collectionName)) {
        throw new CollectionAlreadyExistsError(options?.namespace ?? this.namespace, collectionName);
      }
    }

    await this._httpClient.executeCommand(command, { namespace, timeoutManager });
    return this.collection(collectionName, options);
  }

  /**
   * Drops a collection from the database, including all the contained documents.
   *
   * You can also specify a namespace in the options parameter, which will override the default namespace for this database.
   *
   * @example
   * ```typescript
   * // Uses db's default namespace
   * const success1 = await db.dropCollection("users");
   * console.log(success1); // true
   *
   * // Overrides db's default namespace
   * const success2 = await db.dropCollection("users", {
   *   namespace: "my_namespace"
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

    const resp = await this._httpClient.executeCommand(command, options);

    return resp.status?.ok === 1 && !resp.errors;
  }

  /**
   * Lists the collection names in the database.
   *
   * If you want to include the collection options in the response, set `nameOnly` to `false`, using the other overload.
   *
   * You can also specify a namespace in the options parameter, which will override the default namespace for this database.
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
   * You can also specify a namespace in the options parameter, which will override the default namespace for this database.
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
          // Is 'nameOnly' instead of 'explain' for Mongo-compatibility reasons
          explain: options?.nameOnly !== true,
        },
      },
    }

    const resp = await this._httpClient.executeCommand(command, options);
    return resp.status!.collections;
  }

  /**
   * Send a POST request to the Data API for this database with an arbitrary, caller-provided payload.
   *
   * You can specify a collection to target in the options parameter, thereby allowing you to perform
   * arbitrary collection-level operations as well.
   *
   * You're also able to specify a namespace in the options parameter, which will override the default namespace
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
    return await this._httpClient.executeCommand(command, options);
  }
}

/**
 * @internal
 */
export function mkDb(rootOpts: InternalRootClientOpts, endpointOrId: string, regionOrOptions?: string | DbSpawnOptions, maybeOptions?: DbSpawnOptions) {
  const options = (typeof regionOrOptions === 'string')
    ? maybeOptions
    : regionOrOptions;

  validateDbOpts(options);

  if (typeof regionOrOptions === 'string' && endpointOrId.startsWith('https://')) {
    throw new Error('Unexpected db() argument: database id can\'t start with "https://". Did you mean to call `.db(endpoint, { namespace })`?');
  }
 
  const endpoint = (typeof regionOrOptions === 'string')
    ? 'https://' + endpointOrId + '-' + regionOrOptions + '.apps.astra.datastax.com'
    : endpointOrId;

  return new Db(endpoint, {
    ...rootOpts,
    dbOptions: {
      ...rootOpts.dbOptions,
      ...options,
      token: TokenProvider.parseToken(options?.token ?? rootOpts.dbOptions.token),
    },
  });
}

/**
 * @internal
 */
export function validateDbOpts(opts: DbSpawnOptions | undefined) {
  validateOption('dbOptions', opts, 'object');

  if (!opts) {
    return;
  }

  validateOption('dbOptions.namespace', opts.namespace, 'string', false, (namespace) => {
    if (!namespace.match(/^\w{1,48}$/)) {
      throw new Error('Invalid namespace option; expected a string of 1-48 alphanumeric characters');
    }
  });

  validateOption('dbOptions.monitorCommands', opts.monitorCommands, 'boolean');

  validateOption('dbOptions.dataApiPath', opts.dataApiPath, 'string');
}
