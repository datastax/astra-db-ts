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

import { Db } from "./db";
import {createAstraUri, createNamespace, getKeyspaceName, parseUri} from "./utils";
import { HTTPClient } from "@/src/client";
import { logger } from "@/src/logger";
import { Collection } from "./collection";
import { CreateCollectionOptions } from "./options";

export interface ClientOptions {
  applicationToken?: string;
  baseApiPath?: string;
  logLevel?: string;
  authHeaderName?: string;
  createNamespaceOnConnect?: boolean;
  username?: string;
  password?: string;
  authUrl?: string;
  isAstra?: boolean;
  logSkippedOptions?: boolean;
}

export class Client {
  httpClient: HTTPClient;
  keyspaceName?: string;
  createNamespaceOnConnect?: boolean;

  constructor(baseUrl: string, keyspaceName: string, options: ClientOptions) {
    this.keyspaceName = keyspaceName;
    this.createNamespaceOnConnect = options?.createNamespaceOnConnect ?? true;
    //If the client is connecting to Astra, we don't want to create the namespace
    if (options?.isAstra) {
      this.createNamespaceOnConnect = false;
    }
    this.httpClient = new HTTPClient({
      baseApiPath: options.baseApiPath,
      baseUrl: baseUrl,
      applicationToken: options.applicationToken,
      logLevel: options.logLevel,
      authHeaderName: options.authHeaderName,
      username: options.username,
      password: options.password,
      authUrl: options.authUrl,
      isAstra: options.isAstra,
      logSkippedOptions: options.logSkippedOptions,
    });
  }

  /**
   * Setup a connection to the Astra/Stargate JSON API
   * @param uri an Stargate JSON API uri (Eg. http://localhost:8181/v1/testks1) where testks1 is the name of the keyspace/Namespace which should always be the last part of the URL
   * @returns Client
   */
  static async connect(
    uri: string,
    options?: ClientOptions | null,
  ): Promise<Client> {
    const parsedUri = parseUri(uri);
    const client = new Client(parsedUri.baseUrl, parsedUri.keyspaceName, {
      applicationToken: options?.applicationToken
        ? options?.applicationToken
        : parsedUri.applicationToken,
      baseApiPath: options?.baseApiPath
        ? options?.baseApiPath
        : parsedUri.baseApiPath,
      logLevel: options?.logLevel,
      authHeaderName: options?.authHeaderName,
      createNamespaceOnConnect: options?.createNamespaceOnConnect,
      username: options?.username,
      password: options?.password,
      authUrl: options?.authUrl,
      isAstra: options?.isAstra,
      logSkippedOptions: options?.logSkippedOptions,
    });
    await client.connect();
    return client;
  }

  async collection(name: string) {
    return new Collection(this.httpClient, name);
  }

  async createCollection(
    collectionName: string,
    options?: CreateCollectionOptions,
  ) {
    return await this.db().createCollection(collectionName, options);
  }

  async dropCollection(collectionName: string) {
    return await this.db().dropCollection(collectionName);
  }

  /**
   * Connect the Client instance to JSON API (create Namespace automatically when the 'createNamespaceOnConnect' flag is set to true)
   * @returns a Client instance
   */
  async connect(): Promise<Client> {
    if (this.createNamespaceOnConnect && this.keyspaceName) {
      logger.debug("Creating Namespace " + this.keyspaceName);
      await createNamespace(this.httpClient, this.keyspaceName);
    } else {
      logger.debug("Not creating Namespace on connection!");
    }
    return this;
  }

  /**
   * Use a JSON API keyspace
   * @param dbName the JSON API keyspace to connect to
   * @returns Db
   */
  db(dbName?: string) {
    if (dbName) {
      return new Db(this.httpClient, dbName);
    }
    if (this.keyspaceName) {
      return new Db(this.httpClient, this.keyspaceName);
    }
    throw new Error("Database name must be provided");
  }

  /**
   *
   * @param maxListeners
   * @returns number
   */
  setMaxListeners(maxListeners: number) {
    return maxListeners;
  }

  /**
   *
   * @returns Client
   */
  close() {
    return this;
  }

  startSession() {
    throw new Error("startSession() Not Implemented");
  }
}

const DEFAULT_KEYSPACE = "default_keyspace";

export class AstraDB extends Client {
  constructor(...args: any[]) {
    // token: string, API EndPoint: string, keyspace?: string
    const keyspaceName = args[2] || DEFAULT_KEYSPACE;
    const endpoint = createAstraUri(args[1], keyspaceName);
    super(endpoint, keyspaceName, { isAstra: true, applicationToken: args[0] });
  }
}
