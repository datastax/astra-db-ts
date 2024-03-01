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
  CreateCollectionCommand,
  CollectionOptions,
  createCollectionOptionsKeys
} from '@/src/client/types/collections/create-collection';
import { SomeDoc } from '@/src/client/document';
import {
  CollectionInfo, ListCollectionsCommand,
  listCollectionOptionsKeys,
  ListCollectionsOptions
} from '@/src/client/types/collections/list-collection';

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

  get namespace(): string {
    return this._namespace;
  }

  collection<Schema extends SomeDoc = SomeDoc>(name: string): Collection<Schema> {
    return new Collection<Schema>(this, this._httpClient, name);
  }

  async createCollection<Schema extends SomeDoc = SomeDoc>(collectionName: string, options?: CollectionOptions<Schema>): Promise<Collection<Schema>> {
    const command: CreateCollectionCommand = {
      createCollection: {
        name: collectionName,
      },
    };

    if (options) {
      command.createCollection.options = options;
    }

    const resp = await this._httpClient.executeCommand(command, createCollectionOptionsKeys);

    if (resp.errors) {
      throw new DBError(resp.errors, resp.status, 'Error creating collection');
    }

    return this.collection(collectionName);
  }

  async dropCollection(collectionName: string): Promise<boolean> {
    const command = {
      deleteCollection: {
        name: collectionName,
      },
    };

    const resp = await this._httpClient.executeCommand(command);

    if (resp.errors) {
      throw new DBError(resp.errors, resp.status, 'Error dropping collection');
    }

    return resp.status?.ok === 1 && !resp.errors;
  }

  async listCollections<NameOnly extends boolean = false>(options?: ListCollectionsOptions<NameOnly>): Promise<CollectionInfo<NameOnly>[]> {
    const command: ListCollectionsCommand = {
      findCollections: {
        options: {
          explain: options?.nameOnly === false,
        }
      },
    }

    const resp = await this._httpClient.executeCommand(command, listCollectionOptionsKeys);

    if (resp.errors || !resp.status) {
      throw new DBError(resp.errors ?? [], resp.status, 'Error listing collections');
    }

    return (options?.nameOnly !== false)
      ? resp.status.collections.map((name: string) => ({ name }))
      : resp.status.collections;
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

class DBError extends Error {
  constructor(public errors: any[], public status: any, message: string) {
    super(message);
    this.name = "DBError";
  }
}
