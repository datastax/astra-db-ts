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

import { HTTPClient } from "@/src/client";
import {
  CreateCollectionOptions,
  createCollectionOptionsKeys,
} from "./options";
import { Collection } from "./collection";
import { executeOperation, createNamespace, dropNamespace } from "./utils";

export class Db {
  rootHttpClient: HTTPClient;
  httpClient: HTTPClient;
  name: string;

  constructor(httpClient: HTTPClient, name: string) {
    if (!name) {
      throw new Error("Db: name is required");
    }
    this.rootHttpClient = httpClient;
    // use a clone of the underlying http client to support multiple db's from a single connection
    this.httpClient = new HTTPClient({
      baseUrl: httpClient.baseUrl,
      username: httpClient.username,
      password: httpClient.password,
      authUrl: httpClient.authUrl,
      applicationToken: httpClient.applicationToken,
      authHeaderName: httpClient.authHeaderName,
      isAstra: httpClient.isAstra,
      logSkippedOptions: httpClient.logSkippedOptions,
    });
    this.name = name;
  }

  /**
   *
   * @param collectionName
   * @returns Collection
   */
  collection(collectionName: string): Collection {
    if (!collectionName) {
      throw new Error("Db: collection name is required");
    }
    return new Collection(this.httpClient, collectionName);
  }

  /**
   *
   * @param collectionName
   * @param options
   * @returns Promise
   */
  async createCollection(
    collectionName: string,
    options?: CreateCollectionOptions,
  ) {
    return executeOperation(async () => {
      type CreateCollectionCommand = {
        createCollection: {
          name: string;
          options?: CreateCollectionOptions;
        };
      };
      const command: CreateCollectionCommand = {
        createCollection: {
          name: collectionName,
        },
      };
      if (options != null) {
        command.createCollection.options = options;
      }
      return await this.httpClient.executeCommand(
        command,
        createCollectionOptionsKeys,
      );
    });
  }

  /**
   *
   * @param collectionName
   * @returns APIResponse
   */
  async dropCollection(collectionName: string) {
    const command = {
      deleteCollection: {
        name: collectionName,
      },
    };
    return await this.httpClient.executeCommand(command, null);
  }

  /**
   *
   * @returns Promise
   */
  async dropDatabase() {
    if (this.rootHttpClient.isAstra) {
      throw new StargateAstraError(
        "Cannot drop database in Astra. Please use the Astra UI to drop the database.",
      );
    }
    return await dropNamespace(this.rootHttpClient, this.name);
  }

  /**
   *
   * @returns Promise
   */
  async createDatabase() {
    return await createNamespace(this.rootHttpClient, this.name);
  }
}

export class StargateAstraError extends Error {
  message: string;
  constructor(message: string) {
    super(message);
    this.message = message;
  }
}
