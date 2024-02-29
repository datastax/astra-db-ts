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

import { Db } from './db';
import { parseUri, TypeErr } from './utils';
import { HTTPClient, HTTPClientOptions } from '@/src/api';
import { Collection } from './collection';
import { CollectionOptions } from '@/src/client/types/collections/create-collection';
import { SomeDoc } from '@/src/client/document';
import { CollectionInfo } from '@/src/client/types/collections/list-collection';

export class Client implements Disposable {
  httpClient: HTTPClient;
  namespace: string;
  _db: Db;

  constructor(baseUrl: string, namespace: string, options: HTTPClientOptions) {
    this.namespace = namespace;

    if (!options.applicationToken) {
      throw new Error('Application Token is required');
    }

    this.httpClient = new HTTPClient({
      baseUrl: baseUrl,
      keyspaceName: namespace,
      ...options,
    });

    this._db = new Db(this.httpClient, namespace);
  }

  /**
   * Setup a connection to the Astra/Stargate JSON API
   * @param uri an Stargate JSON API uri (Eg. http://localhost:8181/v1/testks1) where testks1 is the name of the keyspace/Namespace which should always be the last part of the URL
   * @param options
   * @returns Client
   */
  static async connect(uri: string, options?: HTTPClientOptions): Promise<Client> {
    const parsedUri = parseUri(uri);

    return new Client(parsedUri.baseUrl, parsedUri.keyspaceName, {
      applicationToken: options?.applicationToken || parsedUri.applicationToken,
      baseApiPath: options?.baseApiPath || parsedUri.baseApiPath,
      logLevel: options?.logLevel,
      logSkippedOptions: options?.logSkippedOptions,
    });
  }

  async collection<Schema extends SomeDoc = SomeDoc>(name: string) {
    return new Collection<Schema>(this._db, name);
  }

  async createCollection<Schema extends SomeDoc = SomeDoc>(collectionName: string, options?: CollectionOptions<Schema>): Promise<Collection<Schema>> {
    return await this.db().createCollection(collectionName, options);
  }

  async dropCollection(collectionName: string): Promise<boolean> {
    return await this.db().dropCollection(collectionName);
  }

  async listCollections<NameOnly extends boolean = false>(): Promise<CollectionInfo<NameOnly>[]> {
    return await this.db().listCollections<NameOnly>();
  }

  db(dbName?: string) {
    if (dbName) {
      return new Db(this.httpClient, dbName);
    }
    if (this._db) {
      return this._db;
    }
    throw new Error("Database name must be provided");
  }

  // ????
  setMaxListeners(maxListeners: number) {
    return maxListeners;
  }

  close() {
    this.httpClient.close();
    return this;
  }

  [Symbol.dispose]() {
    this.close();
  }

  /**
   * @deprecated use {@link namespace} instead
   */
  get keyspaceName() {
    return this.namespace;
  }

  // noinspection JSUnusedGlobalSymbols
  startSession(): TypeErr<'startSession() not implemented'> {
    throw new Error('startSession() not implemented');
  }
}
