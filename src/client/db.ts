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

import { APIResponse, HTTPClient } from '@/src/api';
import { Collection } from './collection';
import { createNamespace, TypeErr } from './utils';
import {
  CreateCollectionCommand, CreateCollectionOptions,
  createCollectionOptionsKeys
} from '@/src/client/types/collections/create-collection';
import { SomeDoc } from '@/src/client/document';
import {
  CollectionInfo, ListCollectionsCommand,
  listCollectionOptionsKeys,
  ListCollectionsOptions
} from '@/src/client/types/collections/list-collection';
import { BaseOptions } from '@/src/client/types/common';

/**
 * Represents an interface to some Astra database instance.
 *
 * **Shouldn't be instantiated directly, use {@link Client.db} to obtain an instance of this class.**
 *
 * @example
 * ```typescript
 * const db = client.db("my-db");
 * ```
 */
export class Db {
  private readonly _httpClient: HTTPClient;
  private readonly _namespace: string;

  constructor(httpClient: HTTPClient, name: string) {
    if (!name) {
      throw new Error("Db: name is required");
    }

    this._httpClient = httpClient.cloneShallow();
    this._httpClient.keyspace = name;
    this._namespace = name;
  }

  /**
   * @return The namespace (aka keyspace) of the database.
   */
  get namespace(): string {
    return this._namespace;
  }

  /**
   * Establishes a reference to a collection in the database. This method does not perform any I/O.
   *
   * **NB. This method does not validate the existence of the collection—it simply creates a reference.**
   *
   * **Unlike the MongoDB driver, this method does not create a collection if it doesn't exist.**
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
   *
   * @return A reference to the collection.
   *
   * @see Collection
   * @see SomeDoc
   */
  collection<Schema extends SomeDoc = SomeDoc>(name: string): Collection<Schema> {
    return new Collection<Schema>(this, this._httpClient, name);
  }

  /**
   * Creates a new collection in the database.
   *
   * **NB. You are limited to 5 collections per database in Astra, so be wary when using this command.**
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
  async createCollection<Schema extends SomeDoc = SomeDoc>(collectionName: string, options?: CreateCollectionOptions<Schema>): Promise<Collection<Schema>> {
    const command: CreateCollectionCommand = {
      createCollection: {
        name: collectionName,
      },
    };

    if (options) {
      command.createCollection.options = options;
    }

    await this._httpClient.executeCommand(command, options, createCollectionOptionsKeys);

    return this.collection(collectionName);
  }

  /**
   * Drops a collection from the database.
   *
   * @param collectionName The name of the collection to drop.
   *
   * @param options Options for the operation.
   *
   * @return A promise that resolves to `true` if the collection was dropped successfully.
   */
  async dropCollection(collectionName: string, options?: BaseOptions): Promise<boolean> {
    const command = {
      deleteCollection: {
        name: collectionName,
      },
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
  async listCollections<NameOnly extends boolean = false>(options?: ListCollectionsOptions<NameOnly>): Promise<CollectionInfo<NameOnly>[]> {
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

  async createDatabase(): Promise<APIResponse> {
    return await createNamespace(this._httpClient, this._namespace);
  }

  async dropDatabase(): Promise<TypeErr<'Cannot drop database in Astra. Please use the Astra UI to drop the database.'>> {
    throw new Error('Cannot drop database in Astra. Please use the Astra UI to drop the database.');
  }

  /**
   * @deprecated Use {@link _namespace} instead.
   */
  get name(): string {
    return this._namespace;
  }
}
