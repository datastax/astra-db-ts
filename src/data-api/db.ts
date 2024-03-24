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

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used in docs
import { Collection, extractDbIdFromUrl, SomeDoc } from '@/src/data-api';
import { DataApiHttpClient, DEFAULT_DATA_API_PATH, DEFAULT_NAMESPACE, RawDataApiResponse } from '@/src/api';
import {
  BaseOptions,
  CollectionInfo,
  CreateCollectionCommand,
  CreateCollectionOptions,
  createCollectionOptionsKeys,
  listCollectionOptionsKeys,
  ListCollectionsCommand,
  ListCollectionsOptions
} from '@/src/data-api/types';
import { DatabaseInfo } from '@/src/devops/types/admin/database-info';
import { AstraDbAdmin, mkDbAdmin } from '@/src/devops/astra-db-admin';
import { AdminSpawnOptions, RootClientOptsWithToken, DbSpawnOptions } from '@/src/client';

type DbOptions = RootClientOptsWithToken & { dataApiOptions: { token: string } };

interface WithNamespace {
  namespace?: string
}

/**
 * Represents an interface to some Astra database instance.
 *
 * **Shouldn't be instantiated directly, use {@link DataApiClient.db} to obtain an instance of this class.**
 *
 * @example
 * ```typescript
 * const db = client.db("my-db");
 * ```
 */
export class Db {
  private readonly _httpClient: DataApiHttpClient;
  private readonly _defaultOpts: RootClientOptsWithToken;
  private readonly _namespace: string;
  private readonly _id?: string;

  constructor(endpoint: string, options: DbOptions) {
    const dbOpts = options.dataApiOptions ?? {};

    this._namespace = dbOpts.namespace ?? DEFAULT_NAMESPACE;
    this._defaultOpts = options;

    if (!this._namespace.match(/^[a-zA-Z0-9_]{1,222}$/)) {
      throw new Error('Invalid namespace format; either pass a valid namespace name, or don\'t pass one at all to use the default namespace');
    }

    this._httpClient = new DataApiHttpClient({
      baseUrl: endpoint,
      applicationToken: dbOpts.token,
      baseApiPath: dbOpts?.dataApiPath || DEFAULT_DATA_API_PATH,
      caller: options.caller,
      logLevel: options.logLevel,
      logSkippedOptions: dbOpts.logSkippedOptions,
      useHttp2: dbOpts.useHttp2,
    });

    this._httpClient.namespace = this._namespace;
    this._id = extractDbIdFromUrl(endpoint);
  }

  /**
   * @return The namespace (aka keyspace) of the database.
   */
  get namespace(): string {
    return this._namespace;
  }

  /**
   * @return The ID of the database if it was successfully parsed from the given API endpoint.
   */
  get id(): string | undefined {
    return this._id;
  }

  admin(options?: AdminSpawnOptions): AstraDbAdmin {
    if (!this._id) {
      throw new Error('Admin operations are only supported on Astra databases');
    }
    return mkDbAdmin(this, this._httpClient, this._defaultOpts, options);
  }

  async info(): Promise<DatabaseInfo> {
    return await this.admin().info().then(i => i.info);
  }

  /**
   * Establishes a reference to a collection in the database. This method does not perform any I/O.
   *
   * **NB. This method does not validate the existence of the collection—it simply creates a reference.**
   *
   * **Unlike the MongoDB driver, this method does not create a collection if it doesn't exist.**
   *
   * Use {@link createCollection} to create a new collection.
   *
   * Typed as `Collection<SomeDoc>` by default, but you can specify a schema type to get a typed collection.
   *
   * @example
   * ```typescript
   * interface User {
   *   name: string,
   *   age?: number,
   * }
   *
   * const users = db.collection<User>("users");
   * users.insertOne({ name: "John" });
   * ```
   *
   * @param name The name of the collection.
   * @param options Options for the connection.
   *
   * @return A reference to the collection.
   *
   * @see Collection
   * @see SomeDoc
   */
  collection<Schema extends SomeDoc = SomeDoc>(name: string, options?: WithNamespace): Collection<Schema> {
    return new Collection<Schema>(this, this._httpClient, name, options?.namespace);
  }

  /**
   * Creates a new collection in the database, and establishes a reference to it.
   *
   * **NB. You are limited to 5 collections per database in Astra, so be wary when using this command.**
   *
   * This is a blocking command which performs actual I/O unlike {@link collection}, which simply creates an
   * unvalidated reference to a collection.
   *
   * Typed as `Collection<SomeDoc>` by default, but you can specify a schema type to get a typed collection.
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
   * ```
   *
   * @param collectionName The name of the collection to create.
   * @param options Options for the collection.
   *
   * @return A promised reference to the newly created collection.
   *
   * @see Collection
   * @see SomeDoc
   */
  async createCollection<Schema extends SomeDoc = SomeDoc>(collectionName: string, options?: CreateCollectionOptions<Schema> & WithNamespace): Promise<Collection<Schema>> {
    const command: CreateCollectionCommand = {
      createCollection: {
        name: collectionName,
        options: {
          defaultId: options?.defaultId,
          indexing: options?.indexing as any,
          vector: options?.vector,
        }
      },
    };

    await this._httpClient.executeCommand(command, options, createCollectionOptionsKeys);

    return this.collection(collectionName, options);
  }

  /**
   * Drops a collection from the database.
   *
   * @param name The name of the collection to drop.
   *
   * @param options Options for the operation.
   *
   * @return A promise that resolves to `true` if the collection was dropped successfully.
   */
  async dropCollection(name: string, options?: BaseOptions & WithNamespace): Promise<boolean> {
    const command = {
      deleteCollection: { name },
    };

    const resp = await this._httpClient.executeCommand(command, options);

    return resp.status?.ok === 1 && !resp.errors;
  }

  /**
   * Lists the collections in the database.
   *
   * Set `nameOnly` to `true` to only return the names of the collections.
   *
   * Otherwise, the method returns an array of objects with the collection names and their associated {@link CollectionOptions}.
   *
   * @example
   * ```typescript
   * const collections = await db.listCollections({ nameOnly: true });
   * console.log(collections); // [{ name: "users" }, { name: "posts" }]
   * ```
   *
   * @param options Options for the operation.
   *
   * @return A promise that resolves to an array of collection info.
   *
   * @see CollectionOptions
   */
  async listCollections<NameOnly extends boolean = true>(options?: ListCollectionsOptions<NameOnly> & WithNamespace): Promise<CollectionInfo<NameOnly>[]> {
    const command: ListCollectionsCommand = {
      findCollections: {
        options: {
          explain: options?.nameOnly === false,
        }
      },
    }

    const resp = await this._httpClient.executeCommand(command, options, listCollectionOptionsKeys);

    return (options?.nameOnly !== false)
      ? resp.status!.collections.map((name: string) => ({ name }))
      : resp.status!.collections;
  }

  /**
   * Send a POST request to the Data API for this database with an arbitrary, caller-provided payload.
   *
   * You can specify a collection to target with the `collection` parameter, thereby allowing you to perform
   * arbitrary collection-level operations as well.
   *
   * If no collection is specified, the command will be executed at the database level.
   *
   * @example
   * ```typescript
   * const colls = await db.command({ findCollections: {} });
   * console.log(colls); // { status: { collections: [] } }
   *
   * const users = await db.command({ findOne: {} }, "users");
   * console.log(users); // { data: { document: null } }
   * ```
   *
   * @param command The command to send to the Data API.
   * @param options Options for the operation.
   *
   * @return A promise that resolves to the raw response from the Data API.
   */
  async command(command: Record<string, any>, options?: WithNamespace & { collection?: string }): Promise<RawDataApiResponse> {
    return await this._httpClient.executeCommand(command, options);
  }
}

/**
 * @internal
 */
export function mkDb(rootOpts: RootClientOptsWithToken, endpointOrId: string, regionOrOptions?: string | DbSpawnOptions, maybeOptions?: DbSpawnOptions) {
  const options = (typeof regionOrOptions === 'string')
    ? maybeOptions!
    : regionOrOptions;

  const endpoint = (typeof regionOrOptions === 'string')
    ? 'https://' + endpointOrId + '-' + regionOrOptions + '.apps.astra.datastax.com'
    : endpointOrId;

  return new Db(endpoint, {
    ...rootOpts,
    dataApiOptions: {
      ...rootOpts?.dataApiOptions,
      ...options,
    },
  });
}
