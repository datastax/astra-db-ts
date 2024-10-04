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

import { Filter, FindCursor, KeyOf, SomeRow, UpdateFilter } from '@/src/documents';
import { TableInsertOneResult } from '@/src/documents/tables/types/insert/insert-one';
import { DataAPIHttpClient } from '@/src/lib/api/clients/data-api-http-client';
import { CollectionSpawnOptions, Db } from '@/src/db';
import { constUncurried } from '@/src/lib/utils';
import { WithTimeout } from '@/src/lib';
import { CommandImpls } from '@/src/documents/commands/command-impls';
import { TableInsertManyOptions, TableInsertManyResult } from '@/src/documents/tables/types/insert/insert-many';
import { TableUpdateOneOptions, TableUpdateOneResult } from '@/src/documents/tables/types/update/update-one';
import { TableUpdateManyOptions, TableUpdateManyResult } from '@/src/documents/tables/types/update/update-many';
import { TableDeleteOneOptions } from '@/src/documents/tables/types/delete/delete-one';
import { TableFindOptions } from '@/src/documents/tables/types/find/find';
import { FoundRow } from '@/src/documents/tables/types/utils';
import { TableFindOneOptions } from '@/src/documents/tables/types/find/find-one';

export class Table<Schema extends SomeRow = SomeRow> {
  readonly #httpClient: DataAPIHttpClient;
  readonly #commands: CommandImpls<KeyOf<Schema>>;
  // readonly #db: Db;

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
      value: opts?.keyspace ?? db.keyspace,
      writable: false,
    });

    this.#httpClient = httpClient.forCollection(this.keyspace, this.tableName, opts);
    this.#httpClient.baseHeaders['Feature-Flag-tables'] = 'true';
    this.#commands = new CommandImpls(this.#httpClient);
    // this.#db = db;
  }

  public async insertOne(document: Schema[], options?: WithTimeout): Promise<TableInsertOneResult<Schema>> {
    return this.#commands.insertOne(document, options, constUncurried);
  }

  public async insertMany(document: Schema[], options?: TableInsertManyOptions): Promise<TableInsertManyResult<Schema>> {
    return this.#commands.insertMany(document, options, constUncurried);
  }

  public async updateOne(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: TableUpdateOneOptions): Promise<TableUpdateOneResult<Schema>> {
    return this.#commands.updateOne(filter, update, options);
  }

  public async updateMany(filter: Filter<Schema>, update: UpdateFilter<Schema>, options?: TableUpdateManyOptions): Promise<TableUpdateManyResult<Schema>> {
    return this.#commands.updateMany(filter, update, options);
  }

  public async deleteOne(filter: Filter<Schema>, options?: TableDeleteOneOptions): Promise<void> {
    await this.#commands.deleteOne(filter, options);
  }

  public async deleteMany(filter: Filter<Schema>, options?: WithTimeout): Promise<void> {
    void this.#commands.deleteMany(filter, options);
  }

  public find(filter: Filter<Schema>, options?: TableFindOptions): FindCursor<FoundRow<Schema>, FoundRow<Schema>> {
    return this.#commands.find(this.keyspace, filter, options);
  }

  public async findOne(filter: Filter<Schema>, options?: TableFindOneOptions): Promise<FoundRow<Schema> | null> {
    return this.#commands.findOne(filter, options);
  }

  public async countRows(filter: Filter<Schema>, upperBound: number, options?: WithTimeout): Promise<number> {
    return this.#commands.countDocuments(filter, upperBound, options);
  }
}
