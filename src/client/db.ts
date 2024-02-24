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

import { HTTPClient } from '@/src/api';
import { Collection } from './collection';
import { createNamespace, executeOperation, TypeErr } from './utils';
import { CreateCollectionOptions, createCollectionOptionsKeys } from '@/src/client/operations/collections/create-collection';
import { SomeDoc } from '@/src/client/document';
import { APIResponse } from '@/src/api/types';

export class Db {
  httpClient: HTTPClient;
  keyspace: string;

  constructor(httpClient: HTTPClient, name: string) {
    if (!name) {
      throw new Error("Db: name is required");
    }

    this.httpClient = httpClient.cloneShallow();
    this.httpClient.keyspace = name;
    this.keyspace = name;
  }

  collection<Schema extends SomeDoc = SomeDoc>(collectionName: string): Collection<Schema> {
    if (!collectionName) {
      throw new Error("Db: collection name is required");
    }
    return new Collection<Schema>(this.httpClient, collectionName);
  }

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

      const resp = await this.httpClient.executeCommand(command, createCollectionOptionsKeys);

      if (resp.errors) {
        throw new DBError(resp.errors, resp.status, 'Error creating collection');
      }

      return this.collection(collectionName);
    });
  }

  async dropCollection(collectionName: string): Promise<boolean> {
    const command = {
      deleteCollection: {
        name: collectionName,
      },
    };

    const resp = await this.httpClient.executeCommand(command);

    if (resp.errors) {
      throw new DBError(resp.errors, resp.status, 'Error dropping collection');
    }

    return resp.status?.ok === 1 && !resp.errors;
  }

  async createDatabase(): Promise<APIResponse> {
    return await createNamespace(this.httpClient, this.keyspace);
  }

  async dropDatabase(): Promise<TypeErr<'Cannot drop database in Astra. Please use the Astra UI to drop the database.'>> {
    throw new Error('Cannot drop database in Astra. Please use the Astra UI to drop the database.');
  }
}

class DBError extends Error {
  constructor(public errors: any[], public status: any, message: string) {
    super(message);
    this.name = "DBError";
  }
}
