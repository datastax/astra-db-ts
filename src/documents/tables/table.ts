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

import { KeyOf, SomeDoc } from '@/src/documents';
import { TableInsertOneResult } from '@/src/documents/tables/types/insert/insert-one';
import { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { CollectionSpawnOptions, Db } from '@/src/db';
import { resolveKeyspace, uncurriedConst } from '@/src/lib/utils';
import { WithTimeout } from '@/src/lib';
import { CommandImpls } from '@/src/documents/commands/command-impls';

export class Table<Schema extends SomeDoc = SomeDoc> {
  readonly #httpClient: DataAPIHttpClient;
  readonly #commands: CommandImpls<KeyOf<Schema>>;
  readonly #db: Db;

  /**
   * The name of the collection.
   */
  public readonly tableName!: string;

  /**
   * The keyspace that the table resides in.
   */
  public readonly keyspace!: string;

  /**
   * Use {@link Db.collection} to obtain an instance of this class.
   *
   * @internal
   */
  constructor(db: Db, httpClient: DataAPIHttpClient, name: string, opts: CollectionSpawnOptions | undefined) {
    Object.defineProperty(this, 'tableName', {
      value: name,
      writable: false,
    });

    Object.defineProperty(this, 'keyspace', {
      value: resolveKeyspace(opts) ?? db.keyspace,
      writable: false,
    });

    this.#httpClient = httpClient.forCollection(this.keyspace, this.tableName, opts);
    this.#httpClient.baseHeaders['Feature-Flag-tables'] = 'true';
    this.#commands = new CommandImpls(this.#httpClient);
    this.#db = db;
  }

  public async insertOne(document: Schema[], options?: WithTimeout): Promise<TableInsertOneResult<Schema>> {
    return this.#commands.insertOne(document, options, uncurriedConst);
  }
}
