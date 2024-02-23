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

import { HTTPClient } from '@/src/client';
import { SomeDoc, Collection } from './collection';
import { createNamespace, executeOperation, TypeErr } from './utils';
import { CreateCollectionOptions, createCollectionOptionsKeys } from '@/src/collections/operations/collections/create-collection';
import { APIResponse } from '@/src/client/httpClient';

export class Db {
  httpClient: HTTPClient;
  keyspaceName: string;

  constructor(httpClient: HTTPClient, name: string) {
    if (!name) {
      throw new Error("Db: name is required");
    }

    this.httpClient = httpClient.cloneShallow();
    this.httpClient.keyspaceName = name;
    this.keyspaceName = name;
  }

  /**
   *
   * @param collectionName
   * @returns Collection
   */
  collection<Schema extends SomeDoc = SomeDoc>(collectionName: string): Collection<Schema> {
    if (!collectionName) {
      throw new Error("Db: collection name is required");
    }
    return new Collection<Schema>(this.httpClient, collectionName);
  }

  /**
   *
   * @param collectionName
   * @param options
   * @returns Promise
   */
  async createCollection<Schema extends SomeDoc = SomeDoc>(collectionName: string, options?: CreateCollectionOptions<Schema>): Promise<Collection<Schema>> {
    return executeOperation(async () => {
      const command: any = {
        createCollection: {
          name: collectionName,
        },
      };

      if (options) {
        command.createCollection.options = options;
      }

      await this.httpClient.executeCommand(command, createCollectionOptionsKeys);

      return this.collection(collectionName);
    });
  }

  /**
   *
   * @param collectionName
   * @returns Promise
   */
  async dropCollection(collectionName: string): Promise<APIResponse> {
    const command = {
      deleteCollection: {
        name: collectionName,
      },
    };

    return await this.httpClient.executeCommand(command);
  }

  /**
   *
   * @returns Promise
   */
  async dropDatabase(): Promise<TypeErr<'Cannot drop database in Astra. Please use the Astra UI to drop the database.'>> {
    throw new Error('Cannot drop database in Astra. Please use the Astra UI to drop the database.');
  }

  /**
   *
   * @returns Promise
   */
  async createDatabase(): Promise<APIResponse> {
    return await createNamespace(this.httpClient, this.keyspaceName);
  }

  // For backwards compatibility reasons
  get name() {
    return this.keyspaceName;
  }
}
